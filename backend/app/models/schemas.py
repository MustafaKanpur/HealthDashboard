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


class SummaryRequest(BaseModel):
    question: Optional[str] = Field(
        default=None, description="Optional free-text question from the clinician"
    )


class InsightResponse(BaseModel):
    summary: str
    recommendations: list[str] = Field(default_factory=list)
