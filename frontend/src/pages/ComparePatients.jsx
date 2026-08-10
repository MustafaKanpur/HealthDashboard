import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getPatient } from '../api/client.js'
import { IconArrowLeft, IconUsers } from '../icons.jsx'

const RISK_LABELS = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  heart_disease: 'Heart Disease',
}

const LAB_ORDER = ['glucose', 'total_cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'bmi', 'systolic_bp', 'diastolic_bp']

function labFor(patient, key) {
  const lab = patient.labs.find((l) => l.key === key)
  return lab ? `${lab.value} ${lab.unit || ''}` : '—'
}

function ComparePatients() {
  const [searchParams] = useSearchParams()
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(ids.map((id) => getPatient(id)))
      .then((data) => {
        if (!cancelled) setPatients(data)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('ids')])

  if (ids.length < 2) {
    return (
      <div>
        <Link className="back-link" to="/">
          <IconArrowLeft size={15} /> Back to patient search
        </Link>
        <p className="empty-state">Select at least two patients from the search page to compare them.</p>
      </div>
    )
  }

  if (loading) return <p>Loading patients...</p>
  if (error) return <div className="error-banner">{error}</div>

  return (
    <div>
      <Link className="back-link" to="/">
        <IconArrowLeft size={15} /> Back to patient search
      </Link>
      <div className="section compare-table-wrap">
        <h3>
          <IconUsers size={17} /> Patient Comparison
        </h3>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Attribute</th>
              {patients.map((patient) => (
                <th key={patient.id}>{patient.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Age</td>
              {patients.map((patient) => (
                <td key={patient.id}>{patient.age}</td>
              ))}
            </tr>
            <tr>
              <td>Sex</td>
              {patients.map((patient) => (
                <td key={patient.id}>{patient.sex}</td>
              ))}
            </tr>
            <tr>
              <td>Location</td>
              {patients.map((patient) => (
                <td key={patient.id}>
                  {patient.city && patient.state ? `${patient.city}, ${patient.state}` : '—'}
                </td>
              ))}
            </tr>
            {Object.keys(RISK_LABELS).map((key) => (
              <tr key={key}>
                <td>{RISK_LABELS[key]} Risk</td>
                {patients.map((patient) => {
                  const risk = patient.risk_scores[key]
                  return (
                    <td key={patient.id}>
                      {risk ? (
                        <span className={`risk-pill ${risk.label}`}>
                          {Math.round(risk.score * 100)}% ({risk.label})
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {LAB_ORDER.map((key) => (
              <tr key={key}>
                <td>{key.replace(/_/g, ' ')}</td>
                {patients.map((patient) => (
                  <td key={patient.id}>{labFor(patient, key)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td>Conditions on file</td>
              {patients.map((patient) => (
                <td key={patient.id}>{patient.conditions.length}</td>
              ))}
            </tr>
            <tr>
              <td>Medications on file</td>
              {patients.map((patient) => (
                <td key={patient.id}>{patient.medications.length}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparePatients
