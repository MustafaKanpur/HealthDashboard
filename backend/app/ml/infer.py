"""Inference for the three per-disease risk models produced by train.py."""

import json
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

from app.ml.features import TARGETS, build_patient_features
from app.models.schemas import RiskResult

ARTIFACT_DIR = Path(__file__).parent / "artifacts"


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


def predict_risk(patient_id: str, target: str) -> RiskResult:
    pipeline = _load_pipeline(target)
    feature_names = _metadata()[target]["feature_names"]
    features = build_patient_features(patient_id, target)
    row = pd.DataFrame([[features[name] for name in feature_names]], columns=feature_names)
    score = float(pipeline.predict_proba(row)[0][1])
    return RiskResult(score=score, label=_label_for(score), model=_metadata()[target]["chosen_model"])


def predict_all_risks(patient_id: str) -> dict[str, RiskResult]:
    return {target: predict_risk(patient_id, target) for target in TARGETS}
