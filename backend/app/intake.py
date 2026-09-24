"""Adding and editing patients through the app: what the forms ask for, and
writing each change so every part of the dashboard picks it up.

New records are appended to CSVs in loader.USER_DATA_DIR using the Synthea
column layout and Synthea's own codes and wording, so the existing query and
feature code treats a new patient exactly like one from the export. Nothing
is retrained: a new patient is scored by the same trained models, the same
way, as everyone else.
"""

import copy
import threading
import uuid
from datetime import date
from typing import get_args

import pandas as pd

from app.data import PatientNotFoundError, condition_categories, loader, repository
from app.ml import cohort, correlation, explain, features, infer
from app.ml.features import ESTIMABLE_INPUTS, REQUIRED_FOR_ASSESSMENT, adult_panel_medians
from app.models.schemas import (
    ConditionOption,
    IntakeSchemaResponse,
    MeasurementSpec,
    NewPatientMeasurements,
    NewPatientRequest,
    PatientUpdateRequest,
    SmokingStatus,
)

REQUIRED_BASE_FIELDS = ["first_name", "last_name", "birthdate", "sex"]

# How each measurement is written to observations.csv: the LOINC code,
# description, category, unit spelling and type Synthea uses for it, so a new
# reading is indistinguishable from an exported one to repository.py.
_OBSERVATIONS = {
    "systolic_bp": ("8480-6", "Systolic Blood Pressure", "vital-signs", "mm[Hg]", "numeric"),
    "diastolic_bp": ("8462-4", "Diastolic Blood Pressure", "vital-signs", "mm[Hg]", "numeric"),
    "bmi": ("39156-5", "Body Mass Index", "vital-signs", "kg/m2", "numeric"),
    "smoking_status": ("72166-2", "Tobacco smoking status NHIS", "survey", None, "text"),
    "glucose": ("2339-0", "Glucose", "laboratory", "mg/dL", "numeric"),
    "total_cholesterol": ("2093-3", "Total Cholesterol", "laboratory", "mg/dL", "numeric"),
    "hdl_cholesterol": ("2085-9", "High Density Lipoprotein Cholesterol", "laboratory", "mg/dL", "numeric"),
    "ldl_cholesterol": ("18262-6", "Low Density Lipoprotein Cholesterol", "laboratory", "mg/dL", "numeric"),
}

# Diagnoses the form offers. Each is stored under the exact description the
# export uses, so condition categorization, the comorbidity flags and the
# chronic-condition count all see it the way they see an exported record.
# Deliberately a closed list: free text would silently miss the keywords the
# models match on. ("Prediabetes" is left out: it contains "diabet" and would
# be counted as a diabetes diagnosis.)
CONDITION_OPTIONS = [
    ConditionOption(value="Diabetes", label="Diabetes", group="Cardiometabolic"),
    ConditionOption(value="Hypertension", label="Hypertension", group="Cardiometabolic"),
    ConditionOption(value="Coronary Heart Disease", label="Coronary heart disease", group="Cardiometabolic"),
    ConditionOption(
        value="Chronic congestive heart failure (disorder)", label="Congestive heart failure", group="Cardiometabolic"
    ),
    ConditionOption(
        value="History of myocardial infarction (situation)",
        label="Previous myocardial infarction",
        group="Cardiometabolic",
    ),
    ConditionOption(value="Hyperlipidemia", label="Hyperlipidemia", group="Cardiometabolic"),
    ConditionOption(value="Hypertriglyceridemia (disorder)", label="Hypertriglyceridemia", group="Cardiometabolic"),
    ConditionOption(value="Metabolic syndrome X (disorder)", label="Metabolic syndrome", group="Cardiometabolic"),
    ConditionOption(value="Body mass index 30+ - obesity (finding)", label="Obesity", group="Cardiometabolic"),
    ConditionOption(value="Stroke", label="Stroke", group="Other chronic"),
    ConditionOption(value="Anemia (disorder)", label="Anemia", group="Other chronic"),
    ConditionOption(value="Osteoporosis (disorder)", label="Osteoporosis", group="Other chronic"),
    ConditionOption(value="Osteoarthritis of knee", label="Osteoarthritis", group="Other chronic"),
    ConditionOption(value="Asthma", label="Asthma", group="Other chronic"),
    ConditionOption(value="Pulmonary emphysema (disorder)", label="Emphysema", group="Other chronic"),
    ConditionOption(value="Chronic sinusitis (disorder)", label="Chronic sinusitis", group="Other chronic"),
    ConditionOption(value="Chronic low back pain (finding)", label="Chronic low back pain", group="Other chronic"),
    ConditionOption(value="Chronic neck pain (finding)", label="Chronic neck pain", group="Other chronic"),
    ConditionOption(value="Seizure disorder", label="Seizure disorder", group="Other chronic"),
    ConditionOption(value="Chronic intractable migraine without aura", label="Chronic migraine", group="Other chronic"),
]
_CONDITION_VALUES = {option.value for option in CONDITION_OPTIONS}

# Every model input the form collects must have a way to be written, and the
# other way round; a mismatch here would mean a field that's asked for but
# silently dropped.
assert set(_OBSERVATIONS) == set(NewPatientMeasurements.model_fields) == set(
    REQUIRED_FOR_ASSESSMENT + ESTIMABLE_INPUTS
), "intake measurements are out of sync with the model's clinical inputs"


class IntakeValidationError(ValueError):
    """A request that parsed but names something the intake doesn't accept."""

    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field


def intake_schema() -> IntakeSchemaResponse:
    """What the form should render, derived from the request model itself so
    the bounds the form shows are the bounds the API enforces."""
    medians = adult_panel_medians()
    specs = []
    for key, field in NewPatientMeasurements.model_fields.items():
        extra = field.json_schema_extra or {}
        required = key in REQUIRED_FOR_ASSESSMENT
        if key == "smoking_status":
            specs.append(
                MeasurementSpec(
                    key=key,
                    label=extra["label"],
                    kind="choice",
                    options=list(get_args(SmokingStatus)),
                    required_for_assessment=required,
                )
            )
            continue
        bounds = {type(constraint).__name__: constraint for constraint in field.metadata}
        specs.append(
            MeasurementSpec(
                key=key,
                label=extra["label"],
                unit=extra["unit"],
                kind="number",
                min=bounds["Ge"].ge,
                max=bounds["Le"].le,
                step=extra["step"],
                required_for_assessment=required,
                estimate=None if required else round(medians[key], 1),
            )
        )
    return IntakeSchemaResponse(
        required_base_fields=REQUIRED_BASE_FIELDS, measurements=specs, condition_options=CONDITION_OPTIONS
    )


# --- Writing ----------------------------------------------------------------

_WRITE_LOCK = threading.Lock()

# Caches that must survive a new patient. Everything else memoized in the
# data and ML modules is derived from patient data and is cleared.
_PRESERVED_CACHES = {
    "_read_base",  # the Synthea export: immutable at runtime, and the expensive read
    "_load_pipeline",  # trained model artifacts don't change when the data does
    "_metadata",
}
_CACHED_MODULES = (loader, repository, condition_categories, features, infer, explain, correlation, cohort)


def invalidate_data_caches() -> list[str]:
    """Clear every patient-derived cache so the next request rebuilds the
    feature table, predictions, cohorts, correlation matrix and panel summary
    with the new record in them.

    Discovered rather than listed: a hand-maintained list goes stale the day
    someone adds a cache and forgets it here, and a stale cache fails
    silently (the patient just never shows up in the analytics)."""
    cleared = []
    for module in _CACHED_MODULES:
        for name, obj in vars(module).items():
            if name in _PRESERVED_CACHES or getattr(obj, "__module__", None) != module.__name__:
                continue
            if callable(getattr(obj, "cache_clear", None)):
                obj.cache_clear()
                cleared.append(f"{module.__name__}.{name}")
    return cleared


def _append(name: str, rows: list[dict]) -> None:
    if not rows:
        return
    path = loader.user_file(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows, columns=loader.base_columns(name))
    frame.to_csv(path, mode="a", header=not path.exists(), index=False)


def _reading_timestamp(measured_on: date) -> str:
    # Midday UTC: a plain date stamped at midnight can land on the previous
    # day once converted to a western time zone.
    return f"{measured_on.isoformat()}T12:00:00Z"


def _observation_rows(patient_id: str, measurements: NewPatientMeasurements, measured_on: date) -> list[dict]:
    timestamp = _reading_timestamp(measured_on)
    rows = []
    for key, value in measurements.model_dump().items():
        if value is None:
            continue
        code, description, category, units, kind = _OBSERVATIONS[key]
        rows.append(
            {
                "DATE": timestamp,
                "PATIENT": patient_id,
                "CATEGORY": category,
                "CODE": code,
                "DESCRIPTION": description,
                "VALUE": value,
                "UNITS": units,
                "TYPE": kind,
            }
        )
    return rows


def _check_condition_options(field: str, descriptions: list[str]) -> None:
    unknown = [description for description in descriptions if description not in _CONDITION_VALUES]
    if unknown:
        raise IntakeValidationError(field, f"Unknown condition: {unknown[0]}")


def create_patient(request: NewPatientRequest) -> str:
    _check_condition_options("conditions", request.conditions)

    patient_id = str(uuid.uuid4())
    measured_on = request.measured_on or date.today()

    observations = _observation_rows(patient_id, request.measurements, measured_on)
    conditions = [
        {"START": measured_on.isoformat(), "PATIENT": patient_id, "DESCRIPTION": description}
        for description in dict.fromkeys(request.conditions)
    ]
    medications = [
        {"START": _reading_timestamp(measured_on), "PATIENT": patient_id, "DESCRIPTION": description}
        for description in request.medications
    ]
    patient = {
        "Id": patient_id,
        "BIRTHDATE": request.birthdate.isoformat(),
        "FIRST": request.first_name,
        "LAST": request.last_name,
        "GENDER": request.sex,
        "RACE": request.race,
        "ETHNICITY": request.ethnicity,
        "MARITAL": request.marital_status,
        "CITY": request.city,
        "STATE": request.state,
    }

    with _WRITE_LOCK:
        # The patient row goes last: until it exists, the other rows join to
        # nothing and are ignored, so a failure part-way through can't leave
        # a half-written patient visible in the panel.
        _append("observations.csv", observations)
        _append("conditions.csv", conditions)
        _append("medications.csv", medications)
        _append("patients.csv", [patient])
        invalidate_data_caches()

    return patient_id


# --- Editing ----------------------------------------------------------------

# Request field -> patients.csv column, for storing a detail correction.
_DETAIL_COLUMNS = {
    "first_name": "FIRST",
    "last_name": "LAST",
    "birthdate": "BIRTHDATE",
    "sex": "GENDER",
    "race": "RACE",
    "ethnicity": "ETHNICITY",
    "marital_status": "MARITAL",
    "city": "CITY",
    "state": "STATE",
}


def update_patient(patient_id: str, request: PatientUpdateRequest) -> bool:
    """Apply an edit to any patient. Returns whether anything changed.

    Everything is validated against the record before anything is written,
    so a rejected edit leaves no partial trace. Detail corrections, removed
    diagnoses and stopped medications go to the overrides file; a new
    reading, new diagnoses and new medications are appended like any other
    record, so the history they extend stays intact.
    """
    with _WRITE_LOCK:
        if patient_id not in loader.load_patients().index:
            raise PatientNotFoundError(f"No patient with id {patient_id}")
        detail = repository.get_patient_detail(patient_id)
        overrides = loader.read_overrides()
        original_overrides = copy.deepcopy(overrides)
        today = date.today()

        # --- validate everything first -----------------------------------
        _check_condition_options("add_conditions", request.add_conditions)
        on_record = {condition.description for condition in detail.conditions}
        not_on_record = [d for d in request.remove_conditions if d not in on_record]
        if not_on_record:
            raise IntakeValidationError("remove_conditions", f"Not on this patient's record: {not_on_record[0]}")

        medications = loader.load_medications()
        active_courses = medications[(medications["PATIENT"] == patient_id) & medications["STOP"].isna()]
        active_names = set(active_courses["DESCRIPTION"])
        not_active = [d for d in request.stop_medications if d not in active_names]
        if not_active:
            raise IntakeValidationError("stop_medications", f"Not an active medication: {not_active[0]}")

        # --- details: store only what actually differs ---------------------
        submitted = request.details.model_dump()
        changes = {}
        for field, column in _DETAIL_COLUMNS.items():
            if submitted[field] != getattr(detail, field):
                value = submitted[field]
                changes[column] = value.isoformat() if isinstance(value, date) else value
        if changes:
            overrides["patients"].setdefault(patient_id, {}).update(changes)

        # --- diagnoses ------------------------------------------------------
        removed = {(entry["patient"], entry["description"]) for entry in overrides["removed_conditions"]}
        for description in dict.fromkeys(request.remove_conditions):
            if (patient_id, description) not in removed:
                overrides["removed_conditions"].append({"patient": patient_id, "description": description})
                removed.add((patient_id, description))

        new_conditions = []
        for description in dict.fromkeys(request.add_conditions):
            if (patient_id, description) in removed:
                # Previously removed as entered in error: re-adding restores
                # the original entry (and its date) rather than duplicating it.
                overrides["removed_conditions"] = [
                    entry
                    for entry in overrides["removed_conditions"]
                    if (entry["patient"], entry["description"]) != (patient_id, description)
                ]
                removed.discard((patient_id, description))
            elif description not in on_record:
                new_conditions.append({"START": today.isoformat(), "PATIENT": patient_id, "DESCRIPTION": description})

        # --- medications ----------------------------------------------------
        stopping = set(request.stop_medications)
        for _, course in active_courses[active_courses["DESCRIPTION"].isin(stopping)].iterrows():
            overrides["stopped_medications"].append(
                {
                    "patient": patient_id,
                    "description": course["DESCRIPTION"],
                    "start": course["START"].isoformat(),
                    "stop": today.isoformat(),
                }
            )
        still_active = {name.lower() for name in active_names - stopping}
        # A new course is stamped to the second, so a stop recorded against
        # an earlier course of the same drug can never match it.
        started = pd.Timestamp.now(tz="UTC").floor("s").strftime("%Y-%m-%dT%H:%M:%SZ")
        new_medications = [
            {"START": started, "PATIENT": patient_id, "DESCRIPTION": name}
            for name in request.add_medications
            if name.lower() not in still_active
        ]

        # --- new reading ----------------------------------------------------
        new_observations = []
        if request.new_reading is not None:
            new_observations = _observation_rows(
                patient_id, request.new_reading.measurements, request.new_reading.measured_on or today
            )

        overrides_changed = overrides != original_overrides
        if not (overrides_changed or new_conditions or new_medications or new_observations):
            return False

        _append("observations.csv", new_observations)
        _append("conditions.csv", new_conditions)
        _append("medications.csv", new_medications)
        if overrides_changed:
            loader.write_overrides(overrides)
        invalidate_data_caches()
        return True
