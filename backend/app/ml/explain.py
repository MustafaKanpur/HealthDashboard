"""Per-patient SHAP explanations for the risk models trained by train.py.

Complements the heuristic reference-range reasons in infer.py::_explain (which
stay as the plain-language "why" text) with real per-feature attributions from
the trained model itself.
"""

from functools import lru_cache

import numpy as np
import shap

from app.data import PatientNotFoundError
from app.ml.features import _full_feature_table, feature_names_for
from app.ml.infer import _load_pipeline
from app.models.schemas import ShapContribution


@lru_cache(maxsize=None)
def _explainer_for(target: str):
    pipeline = _load_pipeline(target)
    model = pipeline.named_steps["model"]
    feature_names = feature_names_for(target)
    background = pipeline.named_steps["impute"].transform(_full_feature_table()[feature_names])

    if type(model).__name__ == "LogisticRegression":
        return "linear", shap.LinearExplainer(model, background), feature_names
    return "tree", shap.TreeExplainer(model), feature_names


def _positive_class_values(raw, kind: str) -> np.ndarray:
    """Normalize SHAP's various binary-classifier output shapes to a single
    1D array of per-feature contributions toward the positive class."""
    if kind == "linear":
        values = raw
    elif isinstance(raw, list):
        # Older SHAP: list of per-class arrays, each (n_samples, n_features).
        values = raw[-1]
    elif raw.ndim == 3:
        # Newer SHAP: (n_samples, n_features, n_classes).
        values = raw[:, :, -1]
    else:
        values = raw
    return np.asarray(values)[0]


def explain_patient_risk(patient_id: str, target: str) -> list[ShapContribution]:
    kind, explainer, feature_names = _explainer_for(target)
    table = _full_feature_table()
    if patient_id not in table.index:
        raise PatientNotFoundError(f"No patient with id {patient_id}")

    pipeline = _load_pipeline(target)
    row = table.loc[[patient_id], feature_names]
    imputed = pipeline.named_steps["impute"].transform(row)

    if kind == "linear":
        raw = explainer.shap_values(imputed)
    else:
        raw = explainer.shap_values(imputed, check_additivity=False)
    values = _positive_class_values(raw, kind)

    return [ShapContribution(feature=name, value=float(v)) for name, v in zip(feature_names, values)]
