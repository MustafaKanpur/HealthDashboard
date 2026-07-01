"""Claude API integration: turns a patient record + ML risk score into a
plain-language clinical summary and a short list of recommendations.

Requires ANTHROPIC_API_KEY to be set in the environment (see .env.example).
"""

import json

import anthropic

from app.models.schemas import InsightRequest, InsightResponse

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
    "You are a clinical assistant helping a care team interpret a patient's "
    "vitals and an ML-derived risk score. Explain the risk in plain language "
    "and suggest general lifestyle/monitoring recommendations. "
    "You are not diagnosing and must not replace a clinician's judgment."
)

_client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment


def generate_insight(request: InsightRequest) -> InsightResponse:
    patient = request.patient.model_dump()
    user_content = (
        f"Patient data: {json.dumps(patient)}\n"
        f"ML risk score: {request.risk_score}\n"
    )
    if request.question:
        user_content += f"Question from the care team: {request.question}\n"

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