"""Cohort comparison: is this patient's risk typical for people who actually
resemble them, or an outlier?

Cohort membership comes from KMeans clustering over `features.BASE_FEATURES`
(age, sex, labs, smoking status, chronic-condition count, medication count) —
the same feature set the risk models train on, EXCLUDING the
has_diabetes/has_hypertension/has_heart_disease comorbidity flags and the
risk scores themselves. This exclusion is deliberate, not an oversight: those
flags are downstream of diagnosis status, so clustering on them would make a
patient's "cohort" collapse into "other people with the same diagnosis" —
circular with the very risk score this feature is trying to contextualize.
Clustering only on demographic/clinical inputs finds patients who looked
similar *before* their outcome, which is the actual "is this typical for
someone like them" question.
"""

from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.data import PatientNotFoundError
from app.ml.features import BASE_FEATURES, TARGETS, _full_feature_table, feature_label
from app.ml.infer import predict_all_risks_bulk
from app.models.schemas import CohortComparisonResponse, CohortFeatureComparison

N_CLUSTERS = 8
MIN_COHORT_SIZE = 10


@lru_cache(maxsize=1)
def _cluster_assignments() -> pd.Series:
    """KMeans cluster id per adult patient (restricted to adults for the same
    reason `build_training_data` is: pediatric physiology on these features
    isn't comparable to adult physiology, so mixing them would produce
    meaningless "similar patient" clusters).

    Cached for the process lifetime — same approach as
    correlation.py's population stats and infer.py's predict_all_risks_bulk.
    Nothing else in this codebase does time-based cache invalidation, so this
    doesn't invent a new pattern; it recomputes on the next deploy/restart,
    same as everything else here.
    """
    table = _full_feature_table()
    adults = table[table["age"] >= 18]
    X = adults[BASE_FEATURES]

    pipeline = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("cluster", KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)),
        ]
    )
    labels = pipeline.fit_predict(X)
    return pd.Series(labels, index=adults.index, name="cluster")


def _cohort_ids_for(patient_id: str) -> pd.Index:
    """Ids of every patient sharing this patient's cluster (empty if the
    patient wasn't clustered at all, e.g. a pediatric record)."""
    clusters = _cluster_assignments()
    if patient_id not in clusters.index:
        return pd.Index([])
    cluster_id = clusters.loc[patient_id]
    return clusters[clusters == cluster_id].index


def cohort_comparison(patient_id: str, target: str) -> CohortComparisonResponse:
    if target not in TARGETS:
        raise ValueError(f"Unknown target {target!r}, expected one of {TARGETS}")

    bulk = predict_all_risks_bulk()
    if patient_id not in bulk:
        raise PatientNotFoundError(f"No patient with id {patient_id}")

    cohort_ids = _cohort_ids_for(patient_id)
    patient_score = bulk[patient_id][target].score

    if len(cohort_ids) < MIN_COHORT_SIZE:
        return CohortComparisonResponse(
            sufficient_data=False,
            cohort_size=len(cohort_ids),
            patient_risk_score=patient_score,
            cohort_average_risk_score=0.0,
            cohort_percentile=0.0,
            cohort_risk_distribution=[],
        )

    cohort_scores = np.array([bulk[pid][target].score for pid in cohort_ids])
    percentile = float((cohort_scores < patient_score).mean() * 100)

    return CohortComparisonResponse(
        sufficient_data=True,
        cohort_size=len(cohort_ids),
        patient_risk_score=patient_score,
        cohort_average_risk_score=float(cohort_scores.mean()),
        cohort_percentile=percentile,
        cohort_risk_distribution=[float(score) for score in cohort_scores],
    )


def cohort_feature_comparison(patient_id: str) -> list[CohortFeatureComparison]:
    table = _full_feature_table()
    if patient_id not in table.index:
        raise PatientNotFoundError(f"No patient with id {patient_id}")

    cohort_ids = _cohort_ids_for(patient_id)
    if len(cohort_ids) < MIN_COHORT_SIZE:
        return []

    patient_row = table.loc[patient_id, BASE_FEATURES]
    cohort_means = table.loc[cohort_ids, BASE_FEATURES].mean()

    comparisons = []
    for feature in BASE_FEATURES:
        patient_value = patient_row[feature]
        cohort_average = cohort_means[feature]
        if pd.isna(patient_value) or pd.isna(cohort_average):
            continue
        percent_difference = (
            0.0 if cohort_average == 0 else float((patient_value - cohort_average) / abs(cohort_average) * 100)
        )
        comparisons.append(
            CohortFeatureComparison(
                feature=feature_label(feature),
                patient_value=float(patient_value),
                cohort_average=float(cohort_average),
                percent_difference=percent_difference,
            )
        )

    comparisons.sort(key=lambda comparison: abs(comparison.percent_difference), reverse=True)
    return comparisons
