import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getPatient } from '../api/client.js'
import { IconAlertOctagon, IconAlertTriangle, IconArrowLeft, IconCheckCircle, IconUsers } from '../icons.jsx'
import { CONDITION_LABELS } from '../components/charts/chartTheme.js'
import PageHero from '../components/ui/PageHero.jsx'
import Card from '../components/ui/Card.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'

const LAB_ORDER = ['glucose', 'total_cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'bmi', 'systolic_bp', 'diastolic_bp']
const LAB_NAMES = {
  glucose: 'Glucose',
  total_cholesterol: 'Total cholesterol',
  hdl_cholesterol: 'HDL cholesterol',
  ldl_cholesterol: 'LDL cholesterol',
  bmi: 'BMI',
  systolic_bp: 'Systolic BP',
  diastolic_bp: 'Diastolic BP',
}
const RISK_ICON = { low: IconCheckCircle, moderate: IconAlertTriangle, high: IconAlertOctagon }

function labFor(patient, key) {
  const lab = patient.labs.find((l) => l.key === key)
  return lab ? `${lab.value} ${lab.unit || ''}` : '—'
}

function ComparePatients() {
  const [searchParams] = useSearchParams()
  const idsParam = searchParams.get('ids') || ''
  const ids = idsParam.split(',').filter(Boolean)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const requested = idsParam.split(',').filter(Boolean)
    if (requested.length === 0) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(requested.map((id) => getPatient(id)))
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
  }, [idsParam])

  const backLink = (
    <Link className="back-link reveal" to="/">
      <IconArrowLeft size={15} /> Patient panel
    </Link>
  )

  if (ids.length < 2) {
    return (
      <div>
        {backLink}
        <PageHero meta="Side by side" title="Compare patients" />
        <div className="card empty-panel reveal">
          <span className="empty-panel-icon" aria-hidden="true">
            <IconUsers size={22} />
          </span>
          <div className="empty-panel-title">Pick at least two patients</div>
          <div className="empty-panel-text">Tick the checkboxes on the patient panel, then choose Compare.</div>
        </div>
      </div>
    )
  }

  if (error) return <div className="error-banner">{error}</div>

  return (
    <div>
      {backLink}
      <PageHero
        meta="Side by side"
        title="Compare patients"
        subtitle={`${ids.length} patients — risk scores, labs and record size in one view.`}
      />

      <Card icon={IconUsers} title="Comparison" index={1} className="compare-card">
        {loading ? (
          <Skeleton height={360} radius={12} />
        ) : (
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th />
                  {patients.map((patient) => (
                    <th key={patient.id}>
                      <Link to={`/patients/${patient.id}`} className="compare-patient">
                        <Avatar name={patient.name} size={32} />
                        <span>
                          <span className="compare-patient-name">{patient.name}</span>
                          <span className="compare-patient-sub">
                            <span className="mono">{patient.age}</span> · {patient.sex}
                          </span>
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="compare-group-row">
                  <td colSpan={patients.length + 1}>Predicted risk</td>
                </tr>
                {Object.keys(CONDITION_LABELS).map((key) => (
                  <tr key={key}>
                    <td>{CONDITION_LABELS[key]}</td>
                    {patients.map((patient) => {
                      const risk = patient.risk_scores[key]
                      const Icon = risk ? RISK_ICON[risk.label] : null
                      return (
                        <td key={patient.id}>
                          {risk ? (
                            <span className={`risk-pill ${risk.label}`}>
                              <Icon size={12} strokeWidth={2.2} />
                              {Math.round(risk.score * 100)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="compare-group-row">
                  <td colSpan={patients.length + 1}>Latest labs</td>
                </tr>
                {LAB_ORDER.map((key) => (
                  <tr key={key}>
                    <td>{LAB_NAMES[key]}</td>
                    {patients.map((patient) => (
                      <td key={patient.id} className="mono">
                        {labFor(patient, key)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="compare-group-row">
                  <td colSpan={patients.length + 1}>Record</td>
                </tr>
                <tr>
                  <td>Conditions on file</td>
                  {patients.map((patient) => (
                    <td key={patient.id} className="mono">
                      {patient.conditions.length}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Medications on file</td>
                  {patients.map((patient) => (
                    <td key={patient.id} className="mono">
                      {patient.medications.length}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default ComparePatients
