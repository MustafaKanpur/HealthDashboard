const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    // FastAPI sends a string for most errors but a list of per-field issues
    // for 422s; keep the list on the error so a form can place each one.
    const message = typeof body.detail === 'string' ? body.detail : `Request failed with status ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.detail = body.detail
    throw error
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

export async function getPanelSummary() {
  const data = await request('/api/analytics/panel-summary')
  return {
    total: data.total_patients,
    // Base for any risk share: patients added without vitals aren't scored.
    scored: data.scored_patients,
    high: data.high_risk_counts,
    moderate: data.moderate_risk_counts,
  }
}

export function getIntakeSchema() {
  return request('/api/patients/intake-schema')
}

export function updatePatient(patientId, payload) {
  return request(`/api/patients/${patientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function createPatient(payload) {
  return request('/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function getConditionCorrelation() {
  const data = await request('/api/analytics/condition-correlation')
  return {
    conditions: data.conditions,
    matrix: data.matrix,
    sufficientData: data.sufficient_data,
    nPatients: data.n_patients,
  }
}

export async function getConditionInteractions(patientId) {
  const interactions = await request(`/api/patients/${patientId}/condition-interactions`)
  return interactions.map((interaction) => ({
    sharedFactor: interaction.shared_factor,
    conditions: interaction.conditions,
    contribution: interaction.contribution,
  }))
}

export async function getPatientCohort(patientId, riskTarget) {
  const data = await request(`/api/patients/${patientId}/cohort?risk_target=${riskTarget}`)
  return {
    sufficientData: data.sufficient_data,
    cohortSize: data.cohort_size,
    patientRiskScore: data.patient_risk_score,
    cohortAverageRiskScore: data.cohort_average_risk_score,
    cohortPercentile: data.cohort_percentile,
    cohortRiskDistribution: data.cohort_risk_distribution,
  }
}

export async function getCohortFeatureComparison(patientId) {
  const comparisons = await request(`/api/patients/${patientId}/cohort/feature-comparison`)
  return comparisons.map((comparison) => ({
    feature: comparison.feature,
    patientValue: comparison.patient_value,
    cohortAverage: comparison.cohort_average,
    percentDifference: comparison.percent_difference,
  }))
}
