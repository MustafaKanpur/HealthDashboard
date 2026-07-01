from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.ai import generate_patient_summary
from app.data import PatientNotFoundError, get_patient_detail, search_patients
from app.ml import predict_all_risks
from app.models import InsightResponse, PatientDetailResponse, PatientListResponse, SummaryRequest

app = FastAPI(title="Clinician Chronic Disease Risk Dashboard", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/patients", response_model=PatientListResponse)
def list_patients(
    search: str = Query(default="", description="Case-insensitive substring match on patient name"),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    total, patients = search_patients(search, limit=limit, offset=offset)
    return PatientListResponse(total=total, patients=patients)


@app.get("/api/patients/{patient_id}", response_model=PatientDetailResponse)
def patient_detail(patient_id: str):
    try:
        detail = get_patient_detail(patient_id)
        detail.risk_scores = predict_all_risks(patient_id)
        return detail
    except PatientNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/patients/{patient_id}/summary", response_model=InsightResponse)
def patient_summary(patient_id: str, request: SummaryRequest = SummaryRequest()):
    try:
        detail = get_patient_detail(patient_id)
        detail.risk_scores = predict_all_risks(patient_id)
    except PatientNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return generate_patient_summary(detail, question=request.question)
