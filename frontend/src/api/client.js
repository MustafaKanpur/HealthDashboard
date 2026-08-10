const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed with status ${response.status}`)
  }
  return response.json()
}

// Shared by listPatients and getRiskSummary, which filter the same patient panel.
function appendPanelFilterParams(params, { search = '', sex = '', minAge = '', maxAge = '', conditionCategory = '', medication = '', smokingStatus = '' } = {}) {
  if (search) params.set('search', search)
  if (sex) params.set('sex', sex)
  if (minAge) params.set('min_age', minAge)
  if (maxAge) params.set('max_age', maxAge)
  if (conditionCategory) params.set('condition_category', conditionCategory)
  if (medication) params.set('medication', medication)
  if (smokingStatus) params.set('smoking_status', smokingStatus)
  return params
}

export function listPatients({ riskTarget = '', riskMinLabel = '', limit = 25, offset = 0, ...filters } = {}) {
  const params = appendPanelFilterParams(new URLSearchParams({ limit, offset }), filters)
  if (riskTarget) params.set('risk_target', riskTarget)
  if (riskMinLabel) params.set('risk_min_label', riskMinLabel)
  return request(`/api/patients?${params.toString()}`)
}

export function listConditionCategories() {
  return request('/api/meta/condition-categories')
}

export function getPatient(patientId) {
  return request(`/api/patients/${patientId}`)
}

export function getPatientSummary(patientId, question) {
  return request(`/api/patients/${patientId}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: question || null }),
  })
}

export async function getLabHistory(patientId, labKey) {
  const points = await request(`/api/patients/${patientId}/labs/${labKey}/history`)
  // Adapt the API's snake_case shape to the chart components' documented props.
  return points.map((point) => ({ date: point.observed_on, value: point.value, isAnomaly: point.is_anomaly }))
}

export function getRiskExplanation(patientId, target) {
  return request(`/api/patients/${patientId}/risk/${target}/explain`)
}

export function getRiskSummary({ riskTarget, ...filters } = {}) {
  const params = appendPanelFilterParams(new URLSearchParams({ risk_target: riskTarget }), filters)
  return request(`/api/risk-summary?${params.toString()}`)
}
