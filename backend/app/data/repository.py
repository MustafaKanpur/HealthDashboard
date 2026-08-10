"""Query helpers over the Synthea CSVs, shared by the API layer and the ML
feature pipeline so both compute "age", "latest lab value", etc. identically.
"""

import re
from functools import lru_cache

import pandas as pd

from app.models.schemas import (
    ConditionEntry,
    LabHistoryPoint,
    LabValue,
    MedicationEntry,
    PatientDetailResponse,
    PatientSummary,
)

from . import condition_categories
from .loader import load_conditions, load_encounters, load_medications, load_observations, load_patients

TODAY = pd.Timestamp.now().normalize()

# LOINC codes for the labs/vitals used as model features and shown on the chart.
LAB_CODES: dict[str, list[str]] = {
    "glucose": ["2339-0", "2345-7"],
    "total_cholesterol": ["2093-3"],
    "hdl_cholesterol": ["2085-9"],
    "ldl_cholesterol": ["18262-6"],
    "bmi": ["39156-5"],
    "systolic_bp": ["8480-6"],
    "diastolic_bp": ["8462-4"],
    "smoking_status": ["72166-2"],
}

LAB_LABELS: dict[str, str] = {
    "glucose": "Glucose",
    "total_cholesterol": "Total Cholesterol",
    "hdl_cholesterol": "HDL Cholesterol",
    "ldl_cholesterol": "LDL Cholesterol",
    "bmi": "Body Mass Index",
    "systolic_bp": "Systolic Blood Pressure",
    "diastolic_bp": "Diastolic Blood Pressure",
    "smoking_status": "Smoking Status",
}

NUMERIC_LABS = [key for key in LAB_CODES if key != "smoking_status"]


class PatientNotFoundError(Exception):
    pass


def _clean_name_part(value: str) -> str:
    """Synthea appends random digits to first/last names for uniqueness
    (e.g. "Damon455"); strip them for display so a single name doesn't read
    like two concatenated patient names."""
    return re.sub(r"\d+$", "", value).strip()


def _patient_name(row: pd.Series) -> str:
    return f"{_clean_name_part(row['FIRST'])} {_clean_name_part(row['LAST'])}"


def _get_patient_row(patient_id: str) -> pd.Series:
    patients = load_patients()
    if patient_id not in patients.index:
        raise PatientNotFoundError(f"No patient with id {patient_id}")
    return patients.loc[patient_id]


@lru_cache(maxsize=1)
def _encounter_last_start_by_patient() -> pd.Series:
    encounters = load_encounters()
    return encounters.groupby("PATIENT")["START"].max()


@lru_cache(maxsize=1)
def reference_dates() -> pd.Series:
    """Per-patient 'as of' date: death date, else last encounter start, else today."""
    patients = load_patients()
    last_encounter = _encounter_last_start_by_patient().reindex(patients.index)
    ref = patients["DEATHDATE"].fillna(last_encounter).fillna(TODAY)
    return ref


def compute_reference_date(patient_id: str) -> pd.Timestamp:
    return reference_dates().loc[patient_id]


def compute_age(birthdate: pd.Timestamp, reference_date: pd.Timestamp) -> int:
    years = reference_date.year - birthdate.year
    if (reference_date.month, reference_date.day) < (birthdate.month, birthdate.day):
        years -= 1
    return max(years, 0)


@lru_cache(maxsize=1)
def ages() -> pd.Series:
    patients = load_patients()
    refs = reference_dates()
    return pd.Series(
        {pid: compute_age(patients.loc[pid, "BIRTHDATE"], refs.loc[pid]) for pid in patients.index},
        name="age",
    )


@lru_cache(maxsize=None)
def _latest_observations_by_patient(codes: tuple[str, ...]) -> pd.DataFrame:
    obs = load_observations()
    subset = obs[obs["CODE"].isin(codes)].sort_values("DATE")
    latest = subset.drop_duplicates(subset="PATIENT", keep="last")
    return latest.set_index("PATIENT")


def latest_lab_series(lab_key: str) -> pd.DataFrame:
    """Latest VALUE/UNITS/DATE per patient (raw) for a given lab key."""
    codes = tuple(LAB_CODES[lab_key])
    return _latest_observations_by_patient(codes)


def latest_numeric_lab_values(lab_key: str) -> pd.Series:
    """Latest value for a numeric lab, coerced to float, indexed by patient id."""
    table = latest_lab_series(lab_key)
    return pd.to_numeric(table["VALUE"], errors="coerce")


@lru_cache(maxsize=None)
def _lab_readings_by_patient(lab_key: str) -> dict[str, list[tuple[pd.Timestamp, float]]]:
    """Every patient's full chronological reading list for one lab, grouped in a
    single pass so the history endpoint and the list-row sparkline don't each
    re-scan observations.csv."""
    codes = tuple(LAB_CODES[lab_key])
    obs = load_observations()
    subset = obs[obs["CODE"].isin(codes)].copy()
    subset["VALUE"] = pd.to_numeric(subset["VALUE"], errors="coerce")
    subset = subset.dropna(subset=["VALUE"]).sort_values("DATE")
    grouped: dict[str, list[tuple[pd.Timestamp, float]]] = {}
    for patient_id, group in subset.groupby("PATIENT"):
        grouped[patient_id] = list(zip(group["DATE"], group["VALUE"]))
    return grouped


@lru_cache(maxsize=None)
def lab_population_stats(lab_key: str) -> tuple[float, float]:
    """(mean, std) of every reading for a lab, across all patients — used for a
    simple z-score anomaly rule, not a clinical anomaly-detection model."""
    codes = tuple(LAB_CODES[lab_key])
    obs = load_observations()
    values = pd.to_numeric(obs[obs["CODE"].isin(codes)]["VALUE"], errors="coerce").dropna()
    return float(values.mean()), float(values.std())


def lab_history(patient_id: str, lab_key: str) -> list[LabHistoryPoint]:
    readings = _lab_readings_by_patient(lab_key).get(patient_id, [])
    mean, std = lab_population_stats(lab_key)
    points = []
    for observed_on, value in readings:
        is_anomaly = std > 0 and abs(value - mean) > 2.5 * std
        points.append(LabHistoryPoint(observed_on=observed_on.date(), value=float(value), is_anomaly=is_anomaly))
    return points


def recent_lab_trend(patient_id: str, lab_key: str, limit: int = 6) -> list[float]:
    readings = _lab_readings_by_patient(lab_key).get(patient_id, [])
    return [float(value) for _, value in readings[-limit:]]


@lru_cache(maxsize=1)
def conditions_by_patient() -> dict[str, list[str]]:
    """Lower-cased condition descriptions per patient (used for label/feature matching)."""
    conditions = load_conditions()
    grouped = conditions.groupby("PATIENT")["DESCRIPTION"].apply(lambda s: [d.lower() for d in s])
    return grouped.to_dict()


@lru_cache(maxsize=1)
def active_medication_counts() -> pd.Series:
    meds = load_medications()
    active = meds[meds["STOP"].isna()]
    return active.groupby("PATIENT")["DESCRIPTION"].nunique()


def _patient_summary(row: pd.Series) -> PatientSummary:
    return PatientSummary(
        id=row["Id"],
        name=_patient_name(row),
        age=int(ages().loc[row["Id"]]),
        sex=row["GENDER"],
        city=row["CITY"] if pd.notna(row["CITY"]) else None,
        state=row["STATE"] if pd.notna(row["STATE"]) else None,
    )


def summary_for_id(patient_id: str) -> PatientSummary:
    return _patient_summary(_get_patient_row(patient_id))


def filter_patient_ids(
    search: str = "",
    sex: str | None = None,
    min_age: int | None = None,
    max_age: int | None = None,
    condition_category: str | None = None,
    medication: str | None = None,
    smoking_status: str | None = None,
) -> list[str]:
    """Patient ids matching every given filter, sorted by display name.
    Unpaginated — the API layer paginates (and, for risk-based filtering,
    intersects with ML results) after this.
    """
    matches = load_patients()

    if search:
        q = search.strip().lower()
        full_name = (matches["FIRST"].fillna("") + " " + matches["LAST"].fillna("")).str.lower()
        matches = matches[full_name.str.contains(q, na=False, regex=False)]

    if sex:
        matches = matches[matches["GENDER"] == sex]

    if min_age is not None:
        matches = matches[ages().reindex(matches.index) >= min_age]

    if max_age is not None:
        matches = matches[ages().reindex(matches.index) <= max_age]

    ids = list(matches.index)

    if condition_category:
        conditions_map = conditions_by_patient()
        ids = [
            pid
            for pid in ids
            if any(condition_categories.categorize(d) == condition_category for d in conditions_map.get(pid, []))
        ]

    if medication:
        med_query = medication.strip().lower()
        meds = load_medications()
        active_meds = meds[meds["STOP"].isna()]
        matching = active_meds[active_meds["DESCRIPTION"].str.lower().str.contains(med_query, na=False, regex=False)]
        med_patient_ids = set(matching["PATIENT"])
        ids = [pid for pid in ids if pid in med_patient_ids]

    if smoking_status:
        target_value = smoking_status.strip().lower()
        smoking_table = latest_lab_series("smoking_status")
        smoking_patient_ids = {
            pid
            for pid, value in smoking_table["VALUE"].items()
            if isinstance(value, str) and value.strip().lower() == target_value
        }
        ids = [pid for pid in ids if pid in smoking_patient_ids]

    ids.sort(key=lambda pid: _patient_name(matches.loc[pid]))
    return ids


def _patient_conditions(patient_id: str) -> list[ConditionEntry]:
    conditions = load_conditions()
    rows = conditions[conditions["PATIENT"] == patient_id].sort_values("START", ascending=False)
    return [
        ConditionEntry(
            description=row["DESCRIPTION"],
            category=condition_categories.categorize(row["DESCRIPTION"]),
            start=row["START"].date() if pd.notna(row["START"]) else None,
            stop=row["STOP"].date() if pd.notna(row["STOP"]) else None,
            active=pd.isna(row["STOP"]),
        )
        for _, row in rows.iterrows()
    ]


def _patient_medications(patient_id: str) -> list[MedicationEntry]:
    meds = load_medications()
    rows = meds[meds["PATIENT"] == patient_id].sort_values("START", ascending=False)
    return [
        MedicationEntry(
            description=row["DESCRIPTION"],
            start=row["START"].date() if pd.notna(row["START"]) else None,
            stop=row["STOP"].date() if pd.notna(row["STOP"]) else None,
            active=pd.isna(row["STOP"]),
        )
        for _, row in rows.iterrows()
    ]


def _patient_labs(patient_id: str) -> list[LabValue]:
    labs = []
    for key in NUMERIC_LABS:
        table = latest_lab_series(key)
        if patient_id not in table.index:
            continue
        row = table.loc[patient_id]
        value = pd.to_numeric(row["VALUE"], errors="coerce")
        if pd.isna(value):
            continue
        labs.append(
            LabValue(
                key=key,
                label=LAB_LABELS[key],
                value=float(value),
                unit=row["UNITS"] if pd.notna(row["UNITS"]) else None,
                observed_on=row["DATE"].date() if pd.notna(row["DATE"]) else None,
            )
        )
    return labs


def get_patient_detail(patient_id: str) -> PatientDetailResponse:
    row = _get_patient_row(patient_id)
    reference_date = compute_reference_date(patient_id)
    return PatientDetailResponse(
        id=row["Id"],
        name=_patient_name(row),
        age=compute_age(row["BIRTHDATE"], reference_date),
        sex=row["GENDER"],
        birthdate=row["BIRTHDATE"].date(),
        deceased=pd.notna(row["DEATHDATE"]),
        race=row["RACE"] if pd.notna(row["RACE"]) else None,
        ethnicity=row["ETHNICITY"] if pd.notna(row["ETHNICITY"]) else None,
        marital_status=row["MARITAL"] if pd.notna(row["MARITAL"]) else None,
        city=row["CITY"] if pd.notna(row["CITY"]) else None,
        state=row["STATE"] if pd.notna(row["STATE"]) else None,
        conditions=_patient_conditions(patient_id),
        medications=_patient_medications(patient_id),
        labs=_patient_labs(patient_id),
        risk_scores={},
    )
