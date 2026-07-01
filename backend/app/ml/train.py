"""Train a risk-prediction model on a CSV dataset (Synthea/Kaggle export).

Expected columns in backend/data/<dataset>.csv:
    age, sex, bmi, systolic_bp, diastolic_bp, cholesterol, glucose,
    smoker, exercise_hours_per_week, target

`target` is a binary label (1 = adverse outcome / high risk, 0 = otherwise).

Usage:
    python -m app.ml.train --data ../data/patients.csv
"""

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

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


def train_model(data_path: Path) -> RandomForestClassifier:
    df = pd.read_csv(data_path)
    df["smoker"] = df["smoker"].astype(int)

    X = df[FEATURE_ORDER]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42)
    model.fit(X_train, y_train)

    auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    print(f"Validation ROC-AUC: {auc:.4f}")

    joblib.dump(model, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True, help="Path to training CSV")
    args = parser.parse_args()
    train_model(args.data)