"""Train per-disease chronic-risk classifiers and compare LogisticRegression,
RandomForest, and XGBoost, keeping the best (by ROC-AUC) for each target.

Usage:
    python -m app.ml.train
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from app.ml.features import TARGETS, build_training_data

ARTIFACT_DIR = Path(__file__).parent / "artifacts"


def _candidate_models(y_train: pd.Series) -> dict[str, Pipeline]:
    positives = max(int((y_train == 1).sum()), 1)
    negatives = int((y_train == 0).sum())
    scale_pos_weight = negatives / positives

    return {
        "logistic_regression": Pipeline(
            [
                ("impute", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
                ("model", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        ),
        "random_forest": Pipeline(
            [
                ("impute", SimpleImputer(strategy="median")),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=300, max_depth=8, random_state=42, class_weight="balanced"
                    ),
                ),
            ]
        ),
        "xgboost": Pipeline(
            [
                ("impute", SimpleImputer(strategy="median")),
                (
                    "model",
                    XGBClassifier(
                        n_estimators=300,
                        max_depth=4,
                        learning_rate=0.05,
                        eval_metric="logloss",
                        scale_pos_weight=scale_pos_weight,
                        random_state=42,
                    ),
                ),
            ]
        ),
    }


def train_target(target: str) -> dict:
    X, y, feature_names = build_training_data(target)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    results = {}
    best_name, best_pipeline, best_auc = None, None, -1.0
    for name, pipeline in _candidate_models(y_train).items():
        pipeline.fit(X_train, y_train)
        proba = pipeline.predict_proba(X_test)[:, 1]
        roc_auc = roc_auc_score(y_test, proba)
        pr_auc = average_precision_score(y_test, proba)
        results[name] = {"roc_auc": roc_auc, "pr_auc": pr_auc}
        print(f"  {name:20s} ROC-AUC={roc_auc:.4f}  PR-AUC={pr_auc:.4f}")
        if roc_auc > best_auc:
            best_name, best_pipeline, best_auc = name, pipeline, roc_auc

    ARTIFACT_DIR.mkdir(exist_ok=True)
    joblib.dump(best_pipeline, ARTIFACT_DIR / f"{target}.joblib")

    return {
        "target": target,
        "chosen_model": best_name,
        "feature_names": feature_names,
        "n_samples": len(X),
        "positive_rate": float(y.mean()),
        "metrics": results,
    }


def train_all() -> dict:
    metadata = {}
    for target in TARGETS:
        print(f"\nTraining models for target={target!r} (n={build_training_data(target)[0].shape[0]}) ...")
        metadata[target] = train_target(target)
        print(f"  -> best: {metadata[target]['chosen_model']}")

    ARTIFACT_DIR.mkdir(exist_ok=True)
    with open(ARTIFACT_DIR / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"\nSaved model artifacts + metadata to {ARTIFACT_DIR}")
    return metadata


if __name__ == "__main__":
    train_all()
