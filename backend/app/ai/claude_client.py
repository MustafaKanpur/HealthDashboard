"""Claude API integration: turns a patient's chart (demographics, condition
history, recent labs, medications) plus the three ML chronic-disease risk
scores into a plain-language summary for a clinician doing pre-visit review.

Requires ANTHROPIC_API_KEY to be set in the environment (see .env.example).
"""

import json

import anthropic

from app.models.schemas import InsightResponse, PatientDetailResponse

MODEL = "claude-opus-4-8"

_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "recommendations": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "recommendations"],
    "additionalProperties": False,
}

_SYSTEM_PROMPT = (
    "You are a clinical assistant helping a physician quickly review a patient's "
    "chart before a visit. You are given the patient's demographics, condition "
    "history, most recent labs, current medications, and ML-derived risk scores "
    "for diabetes, hypertension, and heart disease. Write a concise plain-language "
    "summary a busy clinician can skim in a few seconds, highlighting anything "
    "notable (elevated risk scores, abnormal labs, relevant condition/medication "
    "history), and suggest general monitoring/follow-up considerations. "
    "You are not diagnosing and must not replace the clinician's judgment."
)

_client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment


def generate_patient_summary(detail: PatientDetailResponse, question: str | None = None) -> InsightResponse:
    chart = detail.model_dump(mode="json")
    user_content = f"Patient chart: {json.dumps(chart)}\n"
    if question:
        user_content += f"Question from the clinician: {question}\n"

    response = _client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        output_config={"format": {"type": "json_schema", "schema": _OUTPUT_SCHEMA}},
        messages=[{"role": "user", "content": user_content}],
    )

    text = next(block.text for block in response.content if block.type == "text")
    data = json.loads(text)
    return InsightResponse(**data)
