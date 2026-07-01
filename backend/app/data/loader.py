"""Cached loaders for the Synthea CSV export in backend/data/."""

from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


@lru_cache(maxsize=1)
def load_patients() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "patients.csv", parse_dates=["BIRTHDATE", "DEATHDATE"])
    return df.set_index("Id", drop=False)


@lru_cache(maxsize=1)
def load_conditions() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / "conditions.csv", parse_dates=["START", "STOP"])


@lru_cache(maxsize=1)
def load_observations() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / "observations.csv", parse_dates=["DATE"])


@lru_cache(maxsize=1)
def load_medications() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / "medications.csv", parse_dates=["START", "STOP"])


@lru_cache(maxsize=1)
def load_encounters() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / "encounters.csv", parse_dates=["START", "STOP"])
