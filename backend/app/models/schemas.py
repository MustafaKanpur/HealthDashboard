from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class PatientSummary(BaseModel):
    """Row shown in the clinician-facing patient search/browse list."""

    id: str
    name: str
    age: int
    sex: str
    city: Optional[str] = None
    state: Optional[str] = None
    glucose_trend: list[float] = Field(
        default_factory=list, description="Up to the last 6 glucose readings, chronological, for a row sparkline"
    )
    source: str = Field("synthea", description="'synthea' (the export) or 'user' (added through the app)")
    risk_assessed: bool = Field(True, description="False for an added patient without enough vitals to be scored")


class PatientListResponse(BaseModel):
    total: int
    patients: list[PatientSummary]


class ConditionEntry(BaseModel):
    description: str
    category: str
    start: Optional[date] = None
    stop: Optional[date] = None
    active: bool


class MedicationEntry(BaseModel):
    description: str
    start: Optional[date] = None
    stop: Optional[date] = None
    active: bool


class LabValue(BaseModel):
    key: str
    label: str
    value: float
    unit: Optional[str] = None
    observed_on: Optional[date] = None


class RiskResult(BaseModel):
    score: float = Field(..., ge=0, le=1, description="Predicted probability of the condition")
    label: str = Field(..., description="'low' | 'moderate' | 'high'")
    model: str = Field(..., description="Algorithm used for this prediction, e.g. 'random_forest'")
    factors: list[str] = Field(
        default_factory=list, description="Heuristic reference-range reasons contributing to this risk score"
    )


class PatientDetailResponse(BaseModel):
    id: str
    name: str
    age: int
    sex: str
    birthdate: date
    deceased: bool
    race: Optional[str] = None
    ethnicity: Optional[str] = None
    marital_status: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    conditions: list[ConditionEntry]
    medications: list[MedicationEntry]
    labs: list[LabValue]
    smoking_status: Optional[str] = Field(None, description="Latest recorded smoking status, if any")
    smoking_observed_on: Optional[date] = None
    first_name: str = Field("", description="Given name as displayed, for pre-filling an edit")
    last_name: str = Field("", description="Family name as displayed, for pre-filling an edit")
    risk_scores: dict[str, RiskResult] = Field(default_factory=dict)
    source: str = Field("synthea", description="'synthea' (the export) or 'user' (added through the app)")
    risk_assessed: bool = True
    missing_for_assessment: list[str] = Field(
        default_factory=list, description="Required inputs still needed before this patient can be scored"
    )
    estimated_inputs: list[str] = Field(
        default_factory=list, description="Model inputs filled with the panel median because none was on file"
    )


class LabHistoryPoint(BaseModel):
    observed_on: date
    value: float
    is_anomaly: bool = Field(..., description="Simple population z-score outlier flag (|z| > 2.5), not clinical ML")


class ShapContribution(BaseModel):
    feature: str
    value: float = Field(..., description="SHAP value: positive pushes risk up, negative pushes it down")


class PanelRiskPoint(BaseModel):
    patient_id: str
    age: int
    risk_score: float = Field(..., ge=0, le=100)
    tier: str = Field(..., description="'low' | 'medium' | 'high'")


class ConditionCorrelationResponse(BaseModel):
    conditions: list[str] = Field(..., description="Target keys, in matrix row/column order")
    matrix: list[list[float]] = Field(
        default_factory=list, description="Spearman correlation; matrix[i][j] = corr(conditions[i], conditions[j])"
    )
    sufficient_data: bool = Field(..., description="False when the scored panel is too small for a meaningful matrix")
    n_patients: int = Field(..., description="Size of the scored panel this was computed over")


class PanelSummaryResponse(BaseModel):
    total_patients: int = Field(..., description="Everyone in the panel, scored or not")
    scored_patients: int = Field(..., description="Patients with risk results; the base for any risk share")
    high_risk_counts: dict[str, int] = Field(..., description="Patients whose risk label is 'high', per target")
    moderate_risk_counts: dict[str, int] = Field(..., description="Patients whose risk label is 'moderate', per target")


class ConditionInteraction(BaseModel):
    shared_factor: str = Field(..., description="Human-readable feature name, e.g. 'Glucose'")
    conditions: list[str] = Field(..., description="Target keys this factor is a top contributor to for this patient")
    contribution: float = Field(..., description="Summed SHAP contribution of this factor across those conditions")


class CohortComparisonResponse(BaseModel):
    sufficient_data: bool = Field(..., description="False when this patient's cluster has too few members")
    cohort_size: int = Field(..., description="Number of patients in this patient's cluster")
    patient_risk_score: float = Field(..., ge=0, le=1)
    cohort_average_risk_score: float = Field(..., ge=0, le=1)
    cohort_percentile: float = Field(
        ..., ge=0, le=100, description="Share of the cohort this patient's risk score is higher than"
    )
    cohort_risk_distribution: list[float] = Field(
        default_factory=list, description="Every cohort member's risk score (0-1), for the distribution chart"
    )


class CohortFeatureComparison(BaseModel):
    feature: str
    patient_value: float
    cohort_average: float
    percent_difference: float = Field(..., description="(patient - cohort average) / |cohort average| * 100")


class SummaryRequest(BaseModel):
    question: Optional[str] = Field(
        default=None, description="Optional free-text question from the clinician"
    )


class InsightResponse(BaseModel):
    summary: str
    recommendations: list[str] = Field(default_factory=list)


# --- Adding a patient -------------------------------------------------------
#
# The numeric bounds below are the single source of truth for what the intake
# form accepts: FastAPI enforces them on POST, and the intake-schema endpoint
# reads them back off these fields for the form to render. They're
# plausibility limits that catch typos (a BP of 1200), not clinical ranges.

SmokingStatus = Literal["Never smoker", "Former smoker", "Current every day smoker"]


def _measure(label: str, unit: str, ge: float, le: float, step: float):
    return Field(None, ge=ge, le=le, json_schema_extra={"label": label, "unit": unit, "step": step})


class NewPatientMeasurements(BaseModel):
    systolic_bp: Optional[float] = _measure("Systolic blood pressure", "mmHg", 60, 260, 1)
    diastolic_bp: Optional[float] = _measure("Diastolic blood pressure", "mmHg", 30, 160, 1)
    bmi: Optional[float] = _measure("Body mass index", "kg/m\u00b2", 10, 80, 0.1)
    smoking_status: Optional[SmokingStatus] = Field(None, json_schema_extra={"label": "Smoking status"})
    glucose: Optional[float] = _measure("Glucose", "mg/dL", 20, 600, 1)
    total_cholesterol: Optional[float] = _measure("Total cholesterol", "mg/dL", 50, 500, 1)
    hdl_cholesterol: Optional[float] = _measure("HDL cholesterol", "mg/dL", 5, 200, 1)
    ldl_cholesterol: Optional[float] = _measure("LDL cholesterol", "mg/dL", 10, 400, 1)

    @model_validator(mode="after")
    def _diastolic_below_systolic(self):
        if self.systolic_bp is not None and self.diastolic_bp is not None and self.diastolic_bp >= self.systolic_bp:
            raise ValueError("Diastolic pressure must be lower than systolic pressure")
        return self


def _clean_medication_names(values: list[str]) -> list[str]:
    """Trim, drop blanks, and collapse case-insensitive duplicates."""
    cleaned, seen = [], set()
    for value in values:
        value = value.strip()
        if not value:
            continue
        if len(value) > 120:
            raise ValueError("Medication names are limited to 120 characters")
        if value.lower() not in seen:
            seen.add(value.lower())
            cleaned.append(value)
    return cleaned


def _check_measured_on(measured_on: Optional[date], birthdate: date) -> None:
    if measured_on is None:
        return
    if measured_on > date.today():
        raise ValueError("Measurement date can't be in the future")
    if measured_on < birthdate:
        raise ValueError("Measurement date can't be before the date of birth")


class PatientDetailsFields(BaseModel):
    """A patient's identifying details, shared by create and edit so both
    enforce the same rules. The first four are the base information a
    patient can't exist without."""

    first_name: str = Field(..., max_length=60)
    last_name: str = Field(..., max_length=60)
    birthdate: date
    sex: Literal["M", "F"]

    race: Optional[Literal["white", "black", "asian", "hawaiian", "native", "other"]] = None
    ethnicity: Optional[Literal["hispanic", "nonhispanic"]] = None
    marital_status: Optional[Literal["M", "S"]] = None
    city: Optional[str] = Field(None, max_length=80)
    state: Optional[str] = Field(None, max_length=80)

    @field_validator("first_name", "last_name")
    @classmethod
    def _name_required(cls, value: str):
        # Whitespace-only would otherwise pass as a name.
        value = value.strip()
        if not value:
            raise ValueError("Required")
        return value

    @field_validator("city", "state")
    @classmethod
    def _blank_to_none(cls, value):
        if value is None:
            return None
        return value.strip() or None

    @field_validator("birthdate")
    @classmethod
    def _plausible_birthdate(cls, value: date):
        today = date.today()
        if value > today:
            raise ValueError("Date of birth can't be in the future")
        if today.year - value.year > 120:
            raise ValueError("Date of birth is more than 120 years ago")
        return value


class NewPatientRequest(PatientDetailsFields):
    measured_on: Optional[date] = Field(None, description="When the measurements were taken; defaults to today")
    measurements: NewPatientMeasurements = Field(default_factory=NewPatientMeasurements)
    conditions: list[str] = Field(default_factory=list, max_length=40)
    medications: list[str] = Field(default_factory=list, max_length=40)

    @field_validator("medications")
    @classmethod
    def _clean_medications(cls, values: list[str]):
        return _clean_medication_names(values)

    @model_validator(mode="after")
    def _measured_on_in_range(self):
        _check_measured_on(self.measured_on, self.birthdate)
        return self


class NewReading(BaseModel):
    """A new set of measurements for an existing patient. Appended to the
    history, never replacing it; the most recent reading drives the score."""

    measured_on: Optional[date] = Field(None, description="Defaults to today")
    measurements: NewPatientMeasurements = Field(default_factory=NewPatientMeasurements)


class PatientUpdateRequest(BaseModel):
    """An edit to any patient. `details` is the full corrected set; only
    fields that differ from the record are stored."""

    details: PatientDetailsFields
    new_reading: Optional[NewReading] = None
    add_conditions: list[str] = Field(default_factory=list, max_length=40)
    remove_conditions: list[str] = Field(default_factory=list, max_length=200)
    add_medications: list[str] = Field(default_factory=list, max_length=40)
    stop_medications: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("add_medications")
    @classmethod
    def _clean_medications(cls, values: list[str]):
        return _clean_medication_names(values)

    @model_validator(mode="after")
    def _reading_in_range(self):
        if self.new_reading is not None:
            _check_measured_on(self.new_reading.measured_on, self.details.birthdate)
        return self


class MeasurementSpec(BaseModel):
    key: str
    label: str
    unit: Optional[str] = None
    kind: Literal["number", "choice"]
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None
    options: list[str] = Field(default_factory=list)
    required_for_assessment: bool
    estimate: Optional[float] = Field(None, description="Panel median used when this value is left blank")


class ConditionOption(BaseModel):
    value: str = Field(..., description="Stored description; matches the Synthea wording the models key on")
    label: str
    group: str


class IntakeSchemaResponse(BaseModel):
    required_base_fields: list[str]
    measurements: list[MeasurementSpec]
    condition_options: list[ConditionOption]
