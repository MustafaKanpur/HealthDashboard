"""Inference helpers for the risk-prediction model produced by train.py."""

from pathlib import Path
from functools import lru_cache

import joblib

from app.models.schemas import PatientRecord, RiskPredictionResponse

FEATURE_ORDER = [
    "age",
    "sex",
    "bmi",
    "systolic_bp",
    "diastolic_bp",
    "cholesterol",
    "glucose",
    "smoker",
    "exercise_hours_per_week",
]

MODEL_PATH = Path(__file__).parent / "model.joblib"


@lru_cache(maxsize=1)
def _load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"No trained model found at {MODEL_PATH}. Run `python -m app.ml.train --data <csv>` first."
        )
    return joblib.load(MODEL_PATH)


def _label_for(score: float) -> str:
    if score < 0.33:
        return "low"
    if score < 0.66:
        return "moderate"
    return "high"


def predict_risk(patient: PatientRecord) -> RiskPredictionResponse:
    model = _load_model()
    features = [
        patient.age,
        patient.sex,
        patient.bmi,
        patient.systolic_bp,
        patient.diastolic_bp,
        patient.cholesterol,
        patient.glucose,
        int(patient.smoker),
        patient.exercise_hours_per_week,
    ]
    score = float(model.predict_proba([features])[0][1])
    return RiskPredictionResponse(risk_score=score, risk_label=_label_for(score))