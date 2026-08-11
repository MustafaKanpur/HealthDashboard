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

## Deployment

- **Frontend → Vercel**: set the project's **Root Directory** to `frontend`
  (this is a monorepo, not a single-package repo). `frontend/vercel.json`
  adds the SPA fallback rewrite React Router needs. Set the
  `VITE_API_BASE_URL` environment variable to your deployed backend's URL.
- **Backend → Render**: `render.yaml` at the repo root is a Render
  [Blueprint](https://render.com/docs/blueprint-spec) — in the Render
  dashboard, "New +" → "Blueprint" → point it at this repo. It builds from
  `backend/` and starts `uvicorn`. You'll be prompted to fill in two env vars
  it deliberately leaves blank (`sync: false`):
  - `ANTHROPIC_API_KEY` — your Claude API key
  - `ALLOWED_ORIGINS` — your deployed Vercel URL (comma-separated if more
    than one, e.g. a preview + production URL); the backend's CORS
    middleware reads this and defaults to `http://localhost:5173` if unset.
  Free-tier Render services spin down after inactivity, so the first request
  after a while will be slow (cold start) — expected, not a bug.
- The trained model artifacts (`backend/app/ml/artifacts/*.joblib`) and the
  Synthea CSVs are committed to the repo, so Render's build doesn't need to
  retrain — it just installs dependencies and starts the server.

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
