"""Cached loaders for the Synthea CSV export in backend/data/, merged with any
patients added through the app, with any edits applied on top.

User-added records live in their own CSVs (USER_DATA_DIR) using the Synthea
column layout, so the export itself is never modified and every downstream
query treats both sources identically. Each public loader returns the merged
frame; the base files are read once per process and kept, so adding a patient
only costs re-reading the (small) user files, not the 500K-row export.

Edits to any patient, exported or added, live in one overrides file rather
than rewriting either source, so the export stays pristine and every edit is
inspectable in one place:

- patient field corrections (name, date of birth, sex, demographics)
- diagnoses removed as entered in error, by (patient, description)
- medications stopped, by (patient, description, course start) with a stop date

New readings, diagnoses and medications aren't overrides: they're appended
to the user CSVs like any other new record.
"""

import json
import os
from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
USER_DATA_DIR = Path(os.environ.get("VITALIS_USER_DATA_DIR", DATA_DIR / "user_added"))

SOURCE_SYNTHEA = "synthea"
SOURCE_USER = "user"

_DATE_COLUMNS = {
    "patients.csv": ["BIRTHDATE", "DEATHDATE"],
    "conditions.csv": ["START", "STOP"],
    "observations.csv": ["DATE"],
    "medications.csv": ["START", "STOP"],
    "encounters.csv": ["START", "STOP"],
}


@lru_cache(maxsize=None)
def _read_base(name: str) -> pd.DataFrame:
    """The Synthea export itself. Deliberately excluded from cache
    invalidation (see app.intake.invalidate_data_caches): it never changes
    at runtime, and it's the expensive read."""
    return pd.read_csv(DATA_DIR / name, parse_dates=_DATE_COLUMNS[name])


def _merged(name: str) -> pd.DataFrame:
    base = _read_base(name)
    user_path = USER_DATA_DIR / name
    if not user_path.exists():
        return base

    user = pd.read_csv(user_path, parse_dates=_DATE_COLUMNS[name])
    # Align each date column to the base file's dtype before concatenating.
    # A column that's entirely empty in the user file (e.g. DEATHDATE) parses
    # as float NaN, and a tz-aware column meeting a naive one degrades to
    # `object` — either way pandas would silently turn the merged column into
    # something date arithmetic no longer works on.
    for column in _DATE_COLUMNS[name]:
        tz_aware = isinstance(base[column].dtype, pd.DatetimeTZDtype)
        user[column] = pd.to_datetime(user[column], utc=tz_aware)
    return pd.concat([base, user], ignore_index=True)


def user_file(name: str) -> Path:
    return USER_DATA_DIR / name


OVERRIDES_FILE = "overrides.json"
EMPTY_OVERRIDES = {"patients": {}, "removed_conditions": [], "stopped_medications": []}


def read_overrides() -> dict:
    path = USER_DATA_DIR / OVERRIDES_FILE
    if not path.exists():
        return {key: type(value)() for key, value in EMPTY_OVERRIDES.items()}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {key: data.get(key, type(value)()) for key, value in EMPTY_OVERRIDES.items()}


def write_overrides(data: dict) -> None:
    """Write via a temp file and rename, so a crash mid-write can't leave a
    truncated overrides file that fails to parse on the next load."""
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = USER_DATA_DIR / OVERRIDES_FILE
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(temp, path)


def base_columns(name: str) -> list[str]:
    """Column order of the Synthea file, so appended rows line up with it."""
    return list(_read_base(name).columns)


@lru_cache(maxsize=1)
def load_patients() -> pd.DataFrame:
    base = _read_base("patients.csv")
    # Copy: with no user file, _merged hands back the cached base frame
    # itself, and the SOURCE column below must not leak into that cache.
    merged = _merged("patients.csv").copy()
    # Tag provenance by position: the first len(base) rows are the export.
    merged["SOURCE"] = [SOURCE_SYNTHEA] * len(base) + [SOURCE_USER] * (len(merged) - len(base))
    patients = merged.set_index("Id", drop=False)

    for patient_id, fields in read_overrides()["patients"].items():
        if patient_id not in patients.index:
            continue
        for column, value in fields.items():
            if column == "BIRTHDATE":
                value = pd.Timestamp(value)
            patients.loc[patient_id, column] = value if value is not None else pd.NA
    return patients


@lru_cache(maxsize=1)
def load_conditions() -> pd.DataFrame:
    conditions = _merged("conditions.csv")
    removed = read_overrides()["removed_conditions"]
    if not removed:
        return conditions
    removed_keys = {(entry["patient"], entry["description"]) for entry in removed}
    keys = pd.MultiIndex.from_frame(conditions[["PATIENT", "DESCRIPTION"]])
    return conditions[~keys.isin(list(removed_keys))].reset_index(drop=True)


@lru_cache(maxsize=1)
def load_observations() -> pd.DataFrame:
    return _merged("observations.csv")


@lru_cache(maxsize=1)
def load_medications() -> pd.DataFrame:
    stopped = read_overrides()["stopped_medications"]
    medications = _merged("medications.csv")
    if not stopped:
        return medications
    medications = medications.copy()  # never write into the cached base frame
    for entry in stopped:
        # Keyed on the course's START too, so stopping a drug can't also stop
        # a later course of the same drug started after it.
        course = (
            (medications["PATIENT"] == entry["patient"])
            & (medications["DESCRIPTION"] == entry["description"])
            & (medications["START"] == pd.Timestamp(entry["start"]))
            & medications["STOP"].isna()
        )
        medications.loc[course, "STOP"] = pd.Timestamp(f"{entry['stop']}T12:00:00Z")
    return medications


@lru_cache(maxsize=1)
def load_encounters() -> pd.DataFrame:
    # Patients added through the app have no encounters; their "as of" date
    # falls through to today in repository.reference_dates().
    return _read_base("encounters.csv")
