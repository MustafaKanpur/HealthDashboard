"""Multi-condition risk correlation analysis.

Two analyses, both built strictly on top of the existing per-condition risk
pipeline (infer.py::predict_all_risks_bulk, explain.py::explain_patient_risk)
rather than recomputing scores or SHAP values independently:

  - `condition_correlation_matrix()` — population-level: do patients who
    score high on one condition tend to score high on another, across the
    whole scored panel?
  - `patient_condition_interactions()` — individual-level: for one patient,
    which of their *elevated* conditions are being pushed up by the same
    underlying feature (e.g. glucose driving both diabetes and heart-disease
    risk for them specifically)?
"""

from functools import lru_cache

import pandas as pd

from app.data import PatientNotFoundError
from app.ml.explain import explain_patient_risk
from app.ml.features import TARGETS, feature_label
from app.ml.infer import predict_all_risks_bulk
from app.models.schemas import ConditionCorrelationResponse, ConditionInteraction

MIN_PATIENTS_FOR_CORRELATION = 30

# How many of a condition's top risk-increasing SHAP contributors count as
# candidates for "shared factor" status. Small enough that a shared factor
# means something (a genuine top driver), not just any feature with a
# positive-but-negligible contribution.
TOP_N_FACTORS = 5


@lru_cache(maxsize=1)
def condition_correlation_matrix() -> ConditionCorrelationResponse:
    """Spearman rank correlation across all target risk scores, over every
    patient the models have scored (reuses predict_all_risks_bulk's own
    cache, so this doesn't trigger any extra inference).

    Cached for the process lifetime, same as predict_all_risks_bulk itself —
    this is a population statistic that only changes when the models are
    retrained (a fresh deploy/process), not per request. There's no
    time-based cache invalidation anywhere else in this codebase to mirror,
    so this deliberately doesn't invent one.
    """
    bulk = predict_all_risks_bulk()
    patient_ids = list(bulk.keys())
    n_patients = len(patient_ids)

    if n_patients < MIN_PATIENTS_FOR_CORRELATION:
        return ConditionCorrelationResponse(
            conditions=list(TARGETS), matrix=[], sufficient_data=False, n_patients=n_patients
        )

    scores = pd.DataFrame({target: [bulk[pid][target].score for pid in patient_ids] for target in TARGETS})
    corr = scores.corr(method="spearman").reindex(index=TARGETS, columns=TARGETS)

    return ConditionCorrelationResponse(
        conditions=list(TARGETS),
        matrix=[[float(value) for value in row] for row in corr.to_numpy()],
        sufficient_data=True,
        n_patients=n_patients,
    )


def patient_condition_interactions(patient_id: str) -> list[ConditionInteraction]:
    """Shared top-contributing risk factors across this patient's elevated
    (moderate/high) conditions, from the same per-condition SHAP values the
    "Why?" panel already shows — not re-derived here.
    """
    bulk = predict_all_risks_bulk()
    if patient_id not in bulk:
        raise PatientNotFoundError(f"No patient with id {patient_id}")

    elevated_targets = [target for target in TARGETS if bulk[patient_id][target].label in ("moderate", "high")]
    if len(elevated_targets) < 2:
        return []

    top_factors_by_target: dict[str, dict[str, float]] = {}
    for target in elevated_targets:
        contributions = explain_patient_risk(patient_id, target)
        positive = sorted((c for c in contributions if c.value > 0), key=lambda c: c.value, reverse=True)
        top_factors_by_target[target] = {c.feature: c.value for c in positive[:TOP_N_FACTORS]}

    feature_to_conditions: dict[str, dict[str, float]] = {}
    for target, factors in top_factors_by_target.items():
        for feature, value in factors.items():
            feature_to_conditions.setdefault(feature, {})[target] = value

    interactions = [
        ConditionInteraction(
            shared_factor=feature_label(feature),
            conditions=list(per_condition_values.keys()),
            contribution=float(sum(per_condition_values.values())),
        )
        for feature, per_condition_values in feature_to_conditions.items()
        if len(per_condition_values) >= 2
    ]
    interactions.sort(key=lambda interaction: interaction.contribution, reverse=True)
    return interactions
