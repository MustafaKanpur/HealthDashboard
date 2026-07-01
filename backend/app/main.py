from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    RiskPredictionRequest,
    RiskPredictionResponse,
    InsightRequest,
    InsightResponse,
)
from app.ml import predict_risk
from app.ai import generate_insight

app = FastAPI(title="Health Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/predict-risk", response_model=RiskPredictionResponse)
def predict(request: RiskPredictionRequest):
    try:
        return predict_risk(request.patient)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/insight", response_model=InsightResponse)
def insight(request: InsightRequest):
    return generate_insight(request)