const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export function listPatients({ search = '', limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams({ search, limit, offset })
  return request(`/api/patients?${params.toString()}`)
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
