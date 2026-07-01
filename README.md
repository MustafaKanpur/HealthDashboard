# Health Dashboard

A health analytics dashboard: a FastAPI backend that trains a scikit-learn
risk-prediction model on patient data and uses the Claude API to turn
predictions into plain-language clinical insights, plus a React (Vite)
frontend.

## Structure

```
health-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI entry point
│   │   ├── models/       # Pydantic request/response schemas
│   │   ├── ml/           # scikit-learn training + inference
│   │   └── ai/           # Claude API integration
│   ├── data/             # Synthea/Kaggle dataset (place CSVs here)
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

Train the risk model (expects a CSV in `data/` with columns `age, sex, bmi,
systolic_bp, diastolic_bp, cholesterol, glucose, smoker,
exercise_hours_per_week, target`):

```bash
python -m app.ml.train --data data/patients.csv
```

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

| Method | Path                 | Description                                  |
| ------ | -------------------- | --------------------------------------------- |
| GET    | `/health`             | Liveness check                                |
| POST   | `/api/predict-risk`   | Run the trained ML model on a patient record  |
| POST   | `/api/insight`        | Get a Claude-generated summary + suggestions  |