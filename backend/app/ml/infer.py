"""Inference for the three per-disease risk models produced by train.py."""

import json
from functools import lru_cache
from pathlib import Path

import pandas as pd
import joblib

from app.ml.features import TARGETS, _full_feature_table, feature_names_for
from app.models.schemas import RiskResult

ARTIFACT_DIR = Path(__file__).parent / "artifacts"

SEVERITY_ORDER = {"low": 0, "moderate": 1, "high": 2}


def _label_for(score: float) -> str:
    if score < 0.33:
        return "low"
    if score < 0.66:
        return "moderate"
    return "high"


@lru_cache(maxsize=1)
def _metadata() -> dict:
    path = ARTIFACT_DIR / "metadata.json"
    if not path.exists():
        raise FileNotFoundError(
            f"No trained models found in {ARTIFACT_DIR}. Run `python -m app.ml.train` first."
        )
    return json.loads(path.read_text())


@lru_cache(maxsize=None)
def _load_pipeline(target: str):
    path = ARTIFACT_DIR / f"{target}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"No trained model for {target!r} at {path}. Run `python -m app.ml.train` first.")
    return joblib.load(path)


def _explain(target: str, features: dict) -> list[str]:
    """Heuristic reference-range explanation of a risk score: reads the same
    feature values fed to the model against standard clinical reference
    ranges. Not per-model feature attribution (e.g. SHAP) — the three targets
    can be served by different algorithm types, so a uniform rule-based
    reading is what stays consistent across all of them.
    """
    reasons = []

    def val(name):
        v = features.get(name)
        return None if v is None or pd.isna(v) else v

    glucose = val("glucose")
    if glucose is not None:
        if glucose >= 126:
            reasons.append(f"Elevated fasting glucose ({glucose:.0f} mg/dL)")
        elif glucose >= 100:
            reasons.append(f"Borderline glucose, prediabetic range ({glucose:.0f} mg/dL)")

    bmi = val("bmi")
    if bmi is not None:
        if bmi >= 30:
            reasons.append(f"Obesity (BMI {bmi:.1f})")
        elif bmi >= 25:
            reasons.append(f"Overweight (BMI {bmi:.1f})")

    systolic, diastolic = val("systolic_bp"), val("diastolic_bp")
    if systolic is not None and diastolic is not None and (systolic >= 130 or diastolic >= 80):
        reasons.append(f"Elevated blood pressure ({systolic:.0f}/{diastolic:.0f} mmHg)")

    total_chol = val("total_cholesterol")
    if total_chol is not None and total_chol >= 200:
        reasons.append(f"Elevated total cholesterol ({total_chol:.0f} mg/dL)")

    ldl = val("ldl_cholesterol")
    if ldl is not None and ldl >= 130:
        reasons.append(f"Elevated LDL cholesterol ({ldl:.0f} mg/dL)")

    hdl, sex = val("hdl_cholesterol"), val("sex")
    if hdl is not None:
        threshold = 40 if sex == 1 else 50
        if hdl < threshold:
            reasons.append(f"Low HDL cholesterol ({hdl:.0f} mg/dL)")

    if val("smoking_status") == 2:
        reasons.append("Current smoker")

    age = val("age")
    if age is not None and age >= 45:
        reasons.append(f"Age {int(age)} increases baseline risk")

    for other in TARGETS:
        if other != target and features.get(f"has_{other}") in (True, 1):
            reasons.append(f"Existing diagnosis of {other.replace('_', ' ')}")

    chronic_count = val("chronic_condition_count")
    if chronic_count is not None and chronic_count >= 3:
        reasons.append(f"Multiple existing chronic conditions ({int(chronic_count)})")

    med_count = val("medication_count")
    if med_count is not None and med_count >= 5:
        reasons.append(f"Currently on {int(med_count)} medications")

    return reasons


@lru_cache(maxsize=1)
def predict_all_risks_bulk() -> dict[str, dict[str, RiskResult]]:
    """Scores every patient for every target in one vectorized pass per
    target (rather than row-by-row) — faster, and it's what the risk-based
    patient filters in the search endpoint need.
    """
    table = _full_feature_table()
    results: dict[str, dict[str, RiskResult]] = {patient_id: {} for patient_id in table.index}

    for target in TARGETS:
        pipeline = _load_pipeline(target)
        feature_names = feature_names_for(target)
        X = table[feature_names]
        scores = pipeline.predict_proba(X)[:, 1]
        chosen_model = _metadata()[target]["chosen_model"]

        for patient_id, score, (_, row) in zip(table.index, scores, X.iterrows()):
            label = _label_for(float(score))
            factors = _explain(target, row.to_dict()) if label != "low" else []
            results[patient_id][target] = RiskResult(
                score=float(score), label=label, model=chosen_model, factors=factors
            )

    return results


def predict_risk(patient_id: str, target: str) -> RiskResult:
    return predict_all_risks_bulk()[patient_id][target]


def predict_all_risks(patient_id: str) -> dict[str, RiskResult]:
    return predict_all_risks_bulk()[patient_id]
