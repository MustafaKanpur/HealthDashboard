import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.ai import generate_patient_summary
from app.data import (
    CATEGORY_NAMES,
    LAB_CODES,
    PatientNotFoundError,
    ages,
    filter_patient_ids,
    get_patient_detail,
    lab_history,
    recent_lab_trend,
    summary_for_id,
)
from app.ml import SEVERITY_ORDER, TARGETS, explain_patient_risk, predict_all_risks, predict_all_risks_bulk
from app.models import (
    InsightResponse,
    LabHistoryPoint,
    PanelRiskPoint,
    PatientDetailResponse,
    PatientListResponse,
    ShapContribution,
    SummaryRequest,
)

app = FastAPI(title="Vitalis API", version="0.3.0")

# Comma-separated list, e.g. "http://localhost:5173,https://your-app.vercel.app"
_allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_TIER_FOR_LABEL = {"low": "low", "moderate": "medium", "high": "high"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/meta/condition-categories")
def condition_categories():
    return {"categories": CATEGORY_NAMES}


@app.get("/api/patients", response_model=PatientListResponse)
def list_patients(
    search: str = Query(default="", description="Case-insensitive substring match on patient name"),
    sex: str | None = Query(default=None, description="'M' or 'F'"),
    min_age: int | None = Query(default=None, ge=0),
    max_age: int | None = Query(default=None, ge=0),
    condition_category: str | None = Query(default=None),
    medication: str | None = Query(default=None, description="Substring match on active medications"),
    smoking_status: str | None = Query(default=None),
    risk_target: str | None = Query(default=None, description="'diabetes' | 'hypertension' | 'heart_disease'"),
    risk_min_label: str | None = Query(default=None, description="Minimum severity: 'moderate' or 'high'"),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    ids = filter_patient_ids(
        search=search,
        sex=sex,
        min_age=min_age,
        max_age=max_age,
        condition_category=condition_category,
        medication=medication,
        smoking_status=smoking_status,
    )

    if risk_target and risk_min_label:
        if risk_target not in TARGETS:
            raise HTTPException(status_code=400, detail=f"risk_target must be one of {TARGETS}")
        if risk_min_label not in SEVERITY_ORDER:
            raise HTTPException(status_code=400, detail=f"risk_min_label must be one of {list(SEVERITY_ORDER)}")
        bulk = predict_all_risks_bulk()
        threshold = SEVERITY_ORDER[risk_min_label]
        ids = [pid for pid in ids if SEVERITY_ORDER[bulk[pid][risk_target].label] >= threshold]

    total = len(ids)
    page_ids = ids[offset : offset + limit]
    patients = []
    for pid in page_ids:
        summary = summary_for_id(pid)
        summary.glucose_trend = recent_lab_trend(pid, "glucose")
        patients.append(summary)
    return PatientListResponse(total=total, patients=patients)


@app.get("/api/risk-summary", response_model=list[PanelRiskPoint])
def risk_summary(
    risk_target: str = Query(..., description="'diabetes' | 'hypertension' | 'heart_disease'"),
    search: str = Query(default=""),
    sex: str | None = Query(default=None),
    min_age: int | None = Query(default=None, ge=0),
    max_age: int | None = Query(default=None, ge=0),
    condition_category: str | None = Query(default=None),
    medication: str | None = Query(default=None),
    smoking_status: str | None = Query(default=None),
):
    if risk_target not in TARGETS:
        raise HTTPException(status_code=400, detail=f"risk_target must be one of {TARGETS}")

    ids = filter_patient_ids(
        search=search,
        sex=sex,
        min_age=min_age,
        max_age=max_age,
        condition_category=condition_category,
        medication=medication,
        smoking_status=smoking_status,
    )
    bulk = predict_all_risks_bulk()
    age_by_patient = ages()

    points = []
    for pid in ids:
        risk = bulk[pid][risk_target]
        points.append(
            PanelRiskPoint(
                patient_id=pid,
                age=int(age_by_patient.loc[pid]),
                risk_score=risk.score * 100,
                tier=_TIER_FOR_LABEL[risk.label],
            )
        )
    return points


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


@app.get("/api/patients/{patient_id}/labs/{lab_key}/history", response_model=list[LabHistoryPoint])
def patient_lab_history(patient_id: str, lab_key: str):
    if lab_key not in LAB_CODES:
        raise HTTPException(status_code=400, detail=f"lab_key must be one of {list(LAB_CODES)}")
    if patient_id not in ages().index:
        raise HTTPException(status_code=404, detail=f"No patient with id {patient_id}")
    return lab_history(patient_id, lab_key)


@app.get("/api/patients/{patient_id}/risk/{target}/explain", response_model=list[ShapContribution])
def patient_risk_explanation(patient_id: str, target: str):
    if target not in TARGETS:
        raise HTTPException(status_code=400, detail=f"target must be one of {TARGETS}")
    try:
        return explain_patient_risk(patient_id, target)
    except PatientNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/patients/{patient_id}/summary", response_model=InsightResponse)
def patient_summary(patient_id: str, request: SummaryRequest = SummaryRequest()):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="AI summary is not configured (missing ANTHROPIC_API_KEY).")
    try:
        detail = get_patient_detail(patient_id)
        detail.risk_scores = predict_all_risks(patient_id)
    except PatientNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return generate_patient_summary(detail, question=request.question)
