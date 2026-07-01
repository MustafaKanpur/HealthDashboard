import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatient, getPatientSummary } from '../api/client.js'

const RISK_LABELS = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  heart_disease: 'Heart Disease',
}

function humanizeModel(model) {
  return model.replace(/_/g, ' ')
}

function RiskCard({ conditionKey, risk }) {
  return (
    <div className={`risk-card ${risk.label}`}>
      <div className="risk-name">{RISK_LABELS[conditionKey] || conditionKey}</div>
      <div className="risk-score">{Math.round(risk.score * 100)}%</div>
      <div className="risk-label">{risk.label} risk</div>
      <div className="risk-model">model: {humanizeModel(risk.model)}</div>
    </div>
  )
}

function PatientDetail() {
  const { patientId } = useParams()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSummary(null)
    setSummaryError(null)
    getPatient(patientId)
      .then((data) => {
        if (!cancelled) setPatient(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const handleGenerateSummary = () => {
    setSummaryLoading(true)
    setSummaryError(null)
    getPatientSummary(patientId)
      .then(setSummary)
      .catch((err) => setSummaryError(err.message))
      .finally(() => setSummaryLoading(false))
  }

  if (loading) return <p>Loading patient...</p>
  if (error) return <div className="error-banner">{error}</div>
  if (!patient) return null

  return (
    <div>
      <Link className="back-link" to="/">
        ← Back to patient search
      </Link>

      <div className="patient-header">
        <h2>{patient.name}</h2>
        <div className="meta">
          {patient.age} yrs · {patient.sex} · {patient.race || 'unknown race'} ·{' '}
          {patient.city && patient.state ? `${patient.city}, ${patient.state}` : 'location unknown'}
          {patient.deceased ? ' · deceased' : ''}
        </div>
      </div>

      <div className="risk-cards">
        {Object.entries(patient.risk_scores).map(([key, risk]) => (
          <RiskCard key={key} conditionKey={key} risk={risk} />
        ))}
      </div>

      <div className="section">
        <h3>Recent Labs</h3>
        {patient.labs.length === 0 ? (
          <p className="empty-state">No lab values on file.</p>
        ) : (
          <div className="lab-grid">
            {patient.labs.map((lab) => (
              <div className="lab-item" key={lab.key}>
                <div className="lab-label">{lab.label}</div>
                <div className="lab-value">
                  {lab.value} {lab.unit || ''}
                </div>
                <div className="lab-date">as of {lab.observed_on}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3>AI Summary</h3>
        {!summary && (
          <button onClick={handleGenerateSummary} disabled={summaryLoading}>
            {summaryLoading ? 'Generating…' : 'Generate AI Summary'}
          </button>
        )}
        {summaryError && <div className="error-banner">{summaryError}</div>}
        {summary && (
          <div className="summary-box">
            <p>{summary.summary}</p>
            {summary.recommendations.length > 0 && (
              <ul>
                {summary.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Condition History ({patient.conditions.length})</h3>
        {patient.conditions.length === 0 ? (
          <p className="empty-state">No conditions on file.</p>
        ) : (
          <ul className="entry-list">
            {patient.conditions.map((condition, index) => (
              <li key={index}>
                <span>{condition.description}</span>
                <span className="entry-dates">
                  {condition.active ? (
                    <span className="badge-active">active since {condition.start}</span>
                  ) : (
                    `${condition.start} – ${condition.stop}`
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section">
        <h3>Medications ({patient.medications.length})</h3>
        {patient.medications.length === 0 ? (
          <p className="empty-state">No medications on file.</p>
        ) : (
          <ul className="entry-list">
            {patient.medications.map((medication, index) => (
              <li key={index}>
                <span>{medication.description}</span>
                <span className="entry-dates">
                  {medication.active ? (
                    <span className="badge-active">active since {medication.start}</span>
                  ) : (
                    `${medication.start} – ${medication.stop}`
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default PatientDetail
