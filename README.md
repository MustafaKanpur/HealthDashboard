# Vitalis

**Live demo: [health-dashboard-theta-five.vercel.app](https://health-dashboard-theta-five.vercel.app/)**
(frontend on Vercel, backend on Render — the backend is on a free tier, so
the first request after a period of inactivity can take 30-50s to wake up).

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

Live at [health-dashboard-theta-five.vercel.app](https://health-dashboard-theta-five.vercel.app/)
(frontend) + [vitalis-api-4ils.onrender.com](https://vitalis-api-4ils.onrender.com)
(backend API). To deploy your own copy:

- **Frontend → Vercel**: set the project's **Root Directory** to `frontend`
  (this is a monorepo, not a single-package repo). `frontend/vercel.json`
  adds the SPA fallback rewrite React Router needs. Set the
  `VITE_API_BASE_URL` environment variable to your deployed backend's URL,
  and redeploy after setting it — Vite bakes `VITE_*` vars into the build,
  it doesn't read them at runtime.
- **Backend → Render**: `render.yaml` at the repo root is a Render
  [Blueprint](https://render.com/docs/blueprint-spec) — in the Render
  dashboard, "New +" → "Blueprint" → point it at this repo. It builds from
  `backend/` and starts `uvicorn`. You'll be prompted to fill in two env vars
  it deliberately leaves blank (`sync: false`):
  - `ANTHROPIC_API_KEY` — your Claude API key (the AI summary endpoint
    returns a clean 503 rather than crashing if this is left unset)
  - `ALLOWED_ORIGINS` — your deployed Vercel URL, comma-separated if more
    than one; defaults to `http://localhost:5173` if unset
  Free-tier Render services spin down after inactivity, so the first request
  after a while will be slow (cold start) — expected, not a bug.
- **CORS and Vercel preview deployments**: Vercel mints a new URL with a
  random hash for every preview deploy (e.g.
  `health-dashboard-<hash>-<team-scope>.vercel.app`), which an exact-match
  `ALLOWED_ORIGINS` list can't keep up with. `backend/app/main.py` also
  matches any deployment of the Vercel project by regex
  (`ALLOWED_ORIGIN_REGEX`, defaults to matching `health-dashboard*.vercel.app`)
  so new preview URLs work without touching Render config — update the
  default pattern if the Vercel project is ever renamed.
- The trained model artifacts (`backend/app/ml/artifacts/*.joblib`) and the
  Synthea CSVs are committed to the repo, so Render's build doesn't need to
  retrain — it just installs dependencies and starts the server.

## API endpoints

| Method | Path                              | Description                                             |
| ------ | ---------------------------------- | --------------------------------------------------------- |
| GET    | `/health`                          | Liveness check                                             |
| GET    | `/api/meta/condition-categories`   | List of condition category names, for filter dropdowns     |
| GET    | `/api/patients`                    | Search/filter patients (`search`, `sex`, `min_age`, `max_age`, `condition_category`, `medication`, `smoking_status`, `risk_target`, `risk_min_label`, `limit`, `offset`); each row includes a recent glucose trend for the list-view sparkline |
| GET    | `/api/risk-summary`                | Panel-wide age/risk-score/tier for every patient matching the same filters as `/api/patients` (unpaginated), for the risk distribution/scatter charts |
| GET    | `/api/patients/{patient_id}`       | Full chart (with categorized conditions) + ML risk scores + heuristic explanation factors |
| GET    | `/api/patients/{patient_id}/labs/{lab_key}/history` | Chronological readings for one lab, each flagged with a population z-score anomaly indicator |
| GET    | `/api/patients/{patient_id}/risk/{target}/explain` | Real per-feature SHAP contributions for one risk target, from the trained model itself |
| POST   | `/api/patients/{patient_id}/summary` | Claude-generated plain-language chart summary (on demand) |

Interactive API docs (Swagger UI): [vitalis-api-4ils.onrender.com/docs](https://vitalis-api-4ils.onrender.com/docs)

## Model Card

Following the spirit of [Mitchell et al., "Model Cards for Model Reporting"
(2019)](https://arxiv.org/abs/1810.03993), scoped to this project.

### Model details

Three independent binary classifiers, one per target condition (diabetes,
hypertension, heart disease). For each target, `python -m app.ml.train`
(`backend/app/ml/train.py`) fits Logistic Regression, Random Forest, and
XGBoost on the same feature set and keeps whichever wins on held-out ROC-AUC.
Current champions, retrained and versioned via
`backend/app/ml/artifacts/metadata.json`:

| Target | Model | ROC-AUC | PR-AUC | Prevalence (training pop.) |
| --- | --- | --- | --- | --- |
| Diabetes | XGBoost | 0.950 | 0.913 | 39.6% |
| Hypertension | Random Forest | 0.839 | 0.768 | 31.8% |
| Heart disease | Random Forest | 0.785 | 0.489 | 13.2% |

(All three algorithms' metrics for each target are recorded in
`metadata.json`, not just the winner — e.g. Logistic Regression scores
0.72–0.81 ROC-AUC across targets, useful as a simpler baseline comparison.)

### Intended use

- **Primary intended use**: a portfolio/demo of an ML-assisted clinical
  decision-support pattern — surfacing a risk score, a plain-language "why"
  (heuristic reference-range reasoning, `backend/app/ml/infer.py::_explain`),
  and real per-feature SHAP attributions alongside a full chart, for a
  clinician to interpret in context.
- **Primary intended users**: engineers/reviewers evaluating this project;
  hypothetically, a clinician using it as one input among many during chart
  review.
- **Out of scope**: this is **not** a validated clinical tool. It must not be
  used for actual diagnosis, treatment decisions, or any real patient care.
  It is trained entirely on synthetic data (see below) and has never been
  evaluated against real-world outcomes.

### Training data

- **Source**: [Synthea](https://synthetichealth.github.io/synthea/), an
  open-source synthetic patient generator — every record in
  `backend/data/*.csv` is algorithmically generated and fictitious; no real
  patient data is used anywhere in this project.
- **Population**: 1,163 synthetic patients total; training is restricted to
  adults (age ≥ 18 at a per-patient reference date, since these three
  conditions are essentially inapplicable to Synthea's many pediatric
  records), leaving 917 patients per model.
- **Labels**: Synthea's own embedded diagnosis logic (ground truth, not
  manually annotated) via `conditions.csv`.
- **Features**: age, sex, most recent glucose / total-HDL-LDL cholesterol /
  BMI / systolic & diastolic BP, smoking status, a curated chronic-condition
  count, active medication count, and comorbidity flags for the *other two*
  target diseases — see `backend/app/ml/features.py` for the full feature
  list and how label leakage is avoided (a target's own diagnosis family is
  excluded from its own condition-count and comorbidity features). Race and
  ethnicity are deliberately **not** used as model features.

### Evaluation

Stratified 80/20 train/test split per target, evaluated on the held-out 20%
(see table above). No external validation set exists — Synthea is the only
data source, so these metrics measure internal consistency on synthetic
data, not real-world generalization.

### Limitations

- **Synthetic data only**: Synthea's generation logic encodes its own
  epidemiological assumptions and feature correlations, which may not match
  real-world patient populations. Strong performance here says nothing about
  real-world performance.
- **Single-state population**: 100% of the 1,163 patients are located in
  Massachusetts (Synthea's default population module). The models have seen
  zero geographic diversity.
- **Cross-sectional, not longitudinal**: risk is predicted from a patient's
  *current* labs/history, not a trajectory toward future onset. An
  already-diagnosed, well-controlled patient (e.g. on antihypertensives with
  normal current BP) can score lower than their diagnosis alone would
  suggest — this is a diagnostic-support framing, not a future-risk model.
- **Small positive-class counts**: heart disease's 13.2% prevalence means
  the held-out test fold has on the order of 25 positive cases; its
  ROC-AUC/PR-AUC gap versus diabetes (39.6% prevalence) reflects a genuinely
  harder and less stable estimation problem, not just a weaker model.
- **Explanations are two different things**: the plain-language "why" is a
  hand-written heuristic reading of reference ranges (glucose ≥126, BMI ≥30,
  etc.), while the SHAP panel is the model's actual per-feature attribution —
  they can legitimately disagree, and neither is a substitute for clinical
  judgment.

### Fairness considerations

- **Race distribution is heavily skewed**: 82.8% white, 8.3% Black, 6.3%
  Asian, 1.5% Native Hawaiian/Pacific Islander, 0.9% other, 0.2% Native
  American (computed directly from `patients.csv`). No per-subgroup
  performance breakdown is computed in this project — several subgroups are
  far too small here for a reliable per-group ROC-AUC — so differential
  performance across race/ethnicity should be **assumed possible, not ruled
  out**, rather than trusted by default.
- **Sex is reasonably balanced** (53% F / 47% M) and is used as a raw model
  feature; no fairness-aware training constraint (e.g. equalized odds) is
  applied.
- Race and ethnicity are excluded from the feature set, which avoids direct
  use of protected attributes but does **not** guarantee equalized outcomes
  across groups — correlated features can still proxy for them, and this
  hasn't been audited for that.
- No probability calibration analysis (whether predicted risk scores are
  equally well-calibrated within subgroups) has been performed.
