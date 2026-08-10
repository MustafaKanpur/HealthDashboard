# Vitalis

A clinician-facing dashboard for browsing Synthea patient records: search and
filter patients (demographics, condition category, medication, smoking
status, disease risk), view a chart (categorized condition history, recent
labs, medications), see ML-predicted risk of three chronic diseases (diabetes,
hypertension, heart disease) with a plain-language "why" behind each score,
compare multiple patients side by side, and generate a Claude-powered
plain-language chart summary. FastAPI backend + scikit-learn/XGBoost models +
React (Vite) frontend.

## Structure

```
health-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI entry point
│   │   ├── data/         # Synthea CSV loading + query layer
│   │   ├── models/       # Pydantic request/response schemas
│   │   ├── ml/           # feature engineering, training, inference
│   │   └── ai/           # Claude API integration
│   ├── data/              # Synthea CSV export (patients/conditions/observations/medications/encounters)
│   └── requirements.txt
├── frontend/              # React app (Vite)
└── README.md
```

## Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # then fill in ANTHROPIC_API_KEY
```

Train the three risk models straight from the Synthea CSVs in `backend/data/`:

```bash
python -m app.ml.train
```

For each of `diabetes`, `hypertension`, and `heart_disease` this trains and
compares Logistic Regression, Random Forest, and XGBoost (ROC-AUC + PR-AUC on
a held-out split), keeps the best model per target, and writes
`app/ml/artifacts/{target}.joblib` + `app/ml/artifacts/metadata.json`.

Run the API:

```bash
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Dev server: http://localhost:5173

## API endpoints

| Method | Path                              | Description                                             |
| ------ | ---------------------------------- | --------------------------------------------------------- |
| GET    | `/health`                          | Liveness check                                             |
| GET    | `/api/meta/condition-categories`   | List of condition category names, for filter dropdowns     |
| GET    | `/api/patients`                    | Search/filter patients (`search`, `sex`, `min_age`, `max_age`, `condition_category`, `medication`, `smoking_status`, `risk_target`, `risk_min_label`, `limit`, `offset`) |
| GET    | `/api/patients/{patient_id}`       | Full chart (with categorized conditions) + ML risk scores + explanation factors |
| POST   | `/api/patients/{patient_id}/summary` | Claude-generated plain-language chart summary (on demand) |

## ML design notes

- **Features**: age, sex, most recent glucose/total-HDL-LDL cholesterol/BMI/
  systolic & diastolic BP, smoking status, a curated chronic-condition count,
  active medication count, and comorbidity flags for the *other two* target
  diseases. See `backend/app/ml/features.py` for the full rationale, including
  how label leakage is avoided (a target's own diagnosis family is excluded
  from its own condition-count feature).
- **Labels**: derived from Synthea's ground-truth `conditions.csv` diagnoses
  (diabetes, hypertension, heart disease families), so no manual labeling is
  needed.
- **Training population**: adults only (age ≥ 18 at a per-patient reference
  date), since these three conditions are essentially not applicable to
  Synthea's many pediatric synthetic patients.
- **Caveat**: risk is predicted from a patient's *current* labs/history, so an
  already-diagnosed, well-controlled patient (e.g. on antihypertensives with
  normal BP) can score lower than their diagnosis alone would suggest. This is
  a "diagnostic-support" framing, not a longitudinal future-risk model.
