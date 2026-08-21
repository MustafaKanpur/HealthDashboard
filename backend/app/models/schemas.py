from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


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
    risk_scores: dict[str, RiskResult] = Field(default_factory=dict)


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
