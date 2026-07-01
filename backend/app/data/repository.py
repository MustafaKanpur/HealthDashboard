"""Query helpers over the Synthea CSVs, shared by the API layer and the ML
feature pipeline so both compute "age", "latest lab value", etc. identically.
"""

from functools import lru_cache

import pandas as pd

from app.models.schemas import ConditionEntry, LabValue, MedicationEntry, PatientDetailResponse, PatientSummary

from .loader import load_conditions, load_encounters, load_medications, load_observations, load_patients

TODAY = pd.Timestamp.now().normalize()

# LOINC codes for the labs/vitals used as model features and shown on the chart.
LAB_CODES: dict[str, list[str]] = {
    "glucose": ["2339-0", "2345-7"],
    "total_cholesterol": ["2093-3"],
    "hdl_cholesterol": ["2085-9"],
    "ldl_cholesterol": ["18262-6"],
    "bmi": ["39156-5"],
    "systolic_bp": ["8480-6"],
    "diastolic_bp": ["8462-4"],
    "smoking_status": ["72166-2"],
}

LAB_LABELS: dict[str, str] = {
    "glucose": "Glucose",
    "total_cholesterol": "Total Cholesterol",
    "hdl_cholesterol": "HDL Cholesterol",
    "ldl_cholesterol": "LDL Cholesterol",
    "bmi": "Body Mass Index",
    "systolic_bp": "Systolic Blood Pressure",
    "diastolic_bp": "Diastolic Blood Pressure",
    "smoking_status": "Smoking Status",
}

NUMERIC_LABS = [key for key in LAB_CODES if key != "smoking_status"]


class PatientNotFoundError(Exception):
    pass


def _patient_name(row: pd.Series) -> str:
    return f"{row['FIRST']} {row['LAST']}"


def _get_patient_row(patient_id: str) -> pd.Series:
    patients = load_patients()
    if patient_id not in patients.index:
        raise PatientNotFoundError(f"No patient with id {patient_id}")
    return patients.loc[patient_id]


@lru_cache(maxsize=1)
def _encounter_last_start_by_patient() -> pd.Series:
    encounters = load_encounters()
    return encounters.groupby("PATIENT")["START"].max()


@lru_cache(maxsize=1)
def reference_dates() -> pd.Series:
    """Per-patient 'as of' date: death date, else last encounter start, else today."""
    patients = load_patients()
    last_encounter = _encounter_last_start_by_patient().reindex(patients.index)
    ref = patients["DEATHDATE"].fillna(last_encounter).fillna(TODAY)
    return ref


def compute_reference_date(patient_id: str) -> pd.Timestamp:
    return reference_dates().loc[patient_id]


def compute_age(birthdate: pd.Timestamp, reference_date: pd.Timestamp) -> int:
    years = reference_date.year - birthdate.year
    if (reference_date.month, reference_date.day) < (birthdate.month, birthdate.day):
        years -= 1
    return max(years, 0)


@lru_cache(maxsize=1)
def ages() -> pd.Series:
    patients = load_patients()
    refs = reference_dates()
    return pd.Series(
        {pid: compute_age(patients.loc[pid, "BIRTHDATE"], refs.loc[pid]) for pid in patients.index},
        name="age",
    )


@lru_cache(maxsize=None)
def _latest_observations_by_patient(codes: tuple[str, ...]) -> pd.DataFrame:
    obs = load_observations()
    subset = obs[obs["CODE"].isin(codes)].sort_values("DATE")
    latest = subset.drop_duplicates(subset="PATIENT", keep="last")
    return latest.set_index("PATIENT")


def latest_lab_series(lab_key: str) -> pd.DataFrame:
    """Latest VALUE/UNITS/DATE per patient (raw) for a given lab key."""
    codes = tuple(LAB_CODES[lab_key])
    return _latest_observations_by_patient(codes)


def latest_numeric_lab_values(lab_key: str) -> pd.Series:
    """Latest value for a numeric lab, coerced to float, indexed by patient id."""
    table = latest_lab_series(lab_key)
    return pd.to_numeric(table["VALUE"], errors="coerce")


@lru_cache(maxsize=1)
def conditions_by_patient() -> dict[str, list[str]]:
    """Lower-cased condition descriptions per patient (used for label/feature matching)."""
    conditions = load_conditions()
    grouped = conditions.groupby("PATIENT")["DESCRIPTION"].apply(lambda s: [d.lower() for d in s])
    return grouped.to_dict()


@lru_cache(maxsize=1)
def active_medication_counts() -> pd.Series:
    meds = load_medications()
    active = meds[meds["STOP"].isna()]
    return active.groupby("PATIENT")["DESCRIPTION"].nunique()


def _patient_summary(row: pd.Series) -> PatientSummary:
    return PatientSummary(
        id=row["Id"],
        name=_patient_name(row),
        age=int(ages().loc[row["Id"]]),
        sex=row["GENDER"],
        city=row["CITY"] if pd.notna(row["CITY"]) else None,
        state=row["STATE"] if pd.notna(row["STATE"]) else None,
    )


def search_patients(query: str = "", limit: int = 25, offset: int = 0) -> tuple[int, list[PatientSummary]]:
    patients = load_patients()
    if query:
        q = query.strip().lower()
        full_name = (patients["FIRST"].fillna("") + " " + patients["LAST"].fillna("")).str.lower()
        matches = patients[full_name.str.contains(q, na=False, regex=False)]
    else:
        matches = patients
    total = len(matches)
    page = matches.iloc[offset : offset + limit]
    summaries = [_patient_summary(row) for _, row in page.iterrows()]
    return total, summaries


def _patient_conditions(patient_id: str) -> list[ConditionEntry]:
    conditions = load_conditions()
    rows = conditions[conditions["PATIENT"] == patient_id].sort_values("START", ascending=False)
    return [
        ConditionEntry(
            description=row["DESCRIPTION"],
            start=row["START"].date() if pd.notna(row["START"]) else None,
            stop=row["STOP"].date() if pd.notna(row["STOP"]) else None,
            active=pd.isna(row["STOP"]),
        )
        for _, row in rows.iterrows()
    ]


def _patient_medications(patient_id: str) -> list[MedicationEntry]:
    meds = load_medications()
    rows = meds[meds["PATIENT"] == patient_id].sort_values("START", ascending=False)
    return [
        MedicationEntry(
            description=row["DESCRIPTION"],
            start=row["START"].date() if pd.notna(row["START"]) else None,
            stop=row["STOP"].date() if pd.notna(row["STOP"]) else None,
            active=pd.isna(row["STOP"]),
        )
        for _, row in rows.iterrows()
    ]


def _patient_labs(patient_id: str) -> list[LabValue]:
    labs = []
    for key in NUMERIC_LABS:
        table = latest_lab_series(key)
        if patient_id not in table.index:
            continue
        row = table.loc[patient_id]
        value = pd.to_numeric(row["VALUE"], errors="coerce")
        if pd.isna(value):
            continue
        labs.append(
            LabValue(
                key=key,
                label=LAB_LABELS[key],
                value=float(value),
                unit=row["UNITS"] if pd.notna(row["UNITS"]) else None,
                observed_on=row["DATE"].date() if pd.notna(row["DATE"]) else None,
            )
        )
    return labs


def get_patient_detail(patient_id: str) -> PatientDetailResponse:
    row = _get_patient_row(patient_id)
    reference_date = compute_reference_date(patient_id)
    return PatientDetailResponse(
        id=row["Id"],
        name=_patient_name(row),
        age=compute_age(row["BIRTHDATE"], reference_date),
        sex=row["GENDER"],
        birthdate=row["BIRTHDATE"].date(),
        deceased=pd.notna(row["DEATHDATE"]),
        race=row["RACE"] if pd.notna(row["RACE"]) else None,
        ethnicity=row["ETHNICITY"] if pd.notna(row["ETHNICITY"]) else None,
        marital_status=row["MARITAL"] if pd.notna(row["MARITAL"]) else None,
        city=row["CITY"] if pd.notna(row["CITY"]) else None,
        state=row["STATE"] if pd.notna(row["STATE"]) else None,
        conditions=_patient_conditions(patient_id),
        medications=_patient_medications(patient_id),
        labs=_patient_labs(patient_id),
        risk_scores={},
    )
