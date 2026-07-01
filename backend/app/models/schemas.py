from typing import Optional
from pydantic import BaseModel, Field


class PatientRecord(BaseModel):
    """A single patient's clinical/demographic record used for ML risk scoring."""

    age: int = Field(..., ge=0, le=120)
    sex: int = Field(..., description="0 = female, 1 = male")
    bmi: float = Field(..., gt=0)
    systolic_bp: float
    diastolic_bp: float
    cholesterol: float
    glucose: float
    smoker: bool = False
    exercise_hours_per_week: float = Field(default=0.0, ge=0)


class RiskPredictionRequest(BaseModel):
    patient: PatientRecord


class RiskPredictionResponse(BaseModel):
    risk_score: float = Field(..., ge=0, le=1, description="Predicted probability of adverse outcome")
    risk_label: str = Field(..., description="e.g. 'low', 'moderate', 'high'")


class InsightRequest(BaseModel):
    patient: PatientRecord
    risk_score: Optional[float] = None
    question: Optional[str] = Field(
        default=None, description="Optional free-text question about the patient's data"
    )


class InsightResponse(BaseModel):
    summary: str
    recommendations: list[str] = Field(default_factory=list)