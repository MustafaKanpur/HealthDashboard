"""Feature engineering for the three chronic-disease risk models.

Builds one shared feature table (`_full_feature_table`) from the Synthea data
layer. `train.py` slices it to adults for `build_training_data(target)`;
`infer.py` uses the full table directly (see `predict_all_risks_bulk`) so
training and serving can never drift apart.
"""

from functools import lru_cache

import pandas as pd

from app.data.loader import load_patients
from app.data.repository import (
    NUMERIC_LABS,
    active_medication_counts,
    ages,
    conditions_by_patient,
    latest_lab_series,
    latest_numeric_lab_values,
)

TARGETS = ["diabetes", "hypertension", "heart_disease"]

# Ground-truth label keywords, matched against lower-cased condition descriptions.
DIABETES_KEYWORDS = ["diabet"]
HYPERTENSION_KEYWORDS = ["hypertension"]
HEART_DISEASE_KEYWORDS = ["coronary heart disease", "myocardial infarction", "cardiac arrest", "heart failure"]

TARGET_KEYWORDS = {
    "diabetes": DIABETES_KEYWORDS,
    "hypertension": HYPERTENSION_KEYWORDS,
    "heart_disease": HEART_DISEASE_KEYWORDS,
}

# Chronic, clinically-meaningful conditions used for the "chronic condition
# count" feature. Deliberately excludes the three target families above (to
# avoid leaking the label into the count) and excludes Synthea's non-clinical
# SDOH "finding" rows (employment, stress, housing, etc.).
GENERIC_CHRONIC_KEYWORDS = [
    "hyperlipidemia",
    "hypertriglyceridemia",
    "metabolic syndrome",
    "obesity",
    "osteoporosis",
    "osteoarthritis",
    "anemia",
    "chronic sinusitis",
    "chronic low back pain",
    "chronic neck pain",
    "stroke",
    "seizure",
    "migraine",
    "asthma",
    "emphysema",
]

SMOKING_ORDINAL = {
    "never smoker": 0.0,
    "former smoker": 1.0,
    "current every day smoker": 2.0,
}

BASE_FEATURES = [
    "age",
    "sex",
    "glucose",
    "total_cholesterol",
    "hdl_cholesterol",
    "ldl_cholesterol",
    "bmi",
    "systolic_bp",
    "diastolic_bp",
    "smoking_status",
    "chronic_condition_count",
    "medication_count",
]


def feature_names_for(target: str) -> list[str]:
    """Base features plus comorbidity flags for the *other* two target diseases."""
    others = [f"has_{t}" for t in TARGETS if t != target]
    return BASE_FEATURES + others


def _has_any(descriptions: list[str], keywords: list[str]) -> bool:
    return any(keyword in description for description in descriptions for keyword in keywords)


def _generic_chronic_count(descriptions: list[str]) -> int:
    return sum(1 for keyword in GENERIC_CHRONIC_KEYWORDS if any(keyword in d for d in descriptions))


@lru_cache(maxsize=1)
def _full_feature_table() -> pd.DataFrame:
    patients = load_patients()
    index = patients.index

    lab_columns = {
        key: latest_numeric_lab_values(key).reindex(index) for key in NUMERIC_LABS if key != "smoking_status"
    }

    smoking_raw = latest_lab_series("smoking_status")["VALUE"].reindex(index)
    smoking_status = smoking_raw.astype(str).str.lower().map(SMOKING_ORDINAL)

    conditions_map = conditions_by_patient()
    chronic_counts, has_diabetes, has_hypertension, has_heart_disease = [], [], [], []
    for patient_id in index:
        descriptions = conditions_map.get(patient_id, [])
        chronic_counts.append(_generic_chronic_count(descriptions))
        has_diabetes.append(_has_any(descriptions, DIABETES_KEYWORDS))
        has_hypertension.append(_has_any(descriptions, HYPERTENSION_KEYWORDS))
        has_heart_disease.append(_has_any(descriptions, HEART_DISEASE_KEYWORDS))

    table = pd.DataFrame(
        {
            "age": ages().reindex(index),
            "sex": patients["GENDER"].map({"M": 1, "F": 0}).reindex(index),
            "glucose": lab_columns["glucose"],
            "total_cholesterol": lab_columns["total_cholesterol"],
            "hdl_cholesterol": lab_columns["hdl_cholesterol"],
            "ldl_cholesterol": lab_columns["ldl_cholesterol"],
            "bmi": lab_columns["bmi"],
            "systolic_bp": lab_columns["systolic_bp"],
            "diastolic_bp": lab_columns["diastolic_bp"],
            "smoking_status": smoking_status,
            "chronic_condition_count": pd.Series(chronic_counts, index=index),
            "medication_count": active_medication_counts().reindex(index).fillna(0),
            "has_diabetes": pd.Series(has_diabetes, index=index),
            "has_hypertension": pd.Series(has_hypertension, index=index),
            "has_heart_disease": pd.Series(has_heart_disease, index=index),
        },
        index=index,
    )
    return table


def build_training_data(target: str) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    """Adult-only feature matrix + binary label for one target disease."""
    if target not in TARGETS:
        raise ValueError(f"Unknown target {target!r}, expected one of {TARGETS}")
    table = _full_feature_table()
    adults = table[table["age"] >= 18]
    feature_names = feature_names_for(target)
    X = adults[feature_names]
    y = adults[f"has_{target}"].astype(int)
    return X, y, feature_names
