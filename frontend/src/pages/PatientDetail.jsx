import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCohortFeatureComparison,
  getConditionInteractions,
  getLabHistory,
  getPatient,
  getPatientCohort,
  getPatientSummary,
  getRiskExplanation,
} from '../api/client.js'
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowLeft,
  IconCheckCircle,
  IconChevronRight,
  IconClipboard,
  IconFlask,
  IconLink,
  IconPill,
  IconSparkle,
  IconTarget,
  IconTrendingUp,
  IconUsers,
} from '../icons.jsx'
import RiskGauge from '../components/charts/RiskGauge.jsx'
import RiskRadarChart from '../components/charts/RiskRadarChart.jsx'
import ShapFeatureBarChart from '../components/charts/ShapFeatureBarChart.jsx'
import VitalsTrendChart from '../components/charts/VitalsTrendChart.jsx'
import AnomalyHighlightChart from '../components/charts/AnomalyHighlightChart.jsx'
import PatientConditionInteractionPanel from '../components/charts/PatientConditionInteractionPanel.jsx'
import CohortComparisonCard from '../components/charts/CohortComparisonCard.jsx'
import CohortFeatureDeltaTable from '../components/charts/CohortFeatureDeltaTable.jsx'

const RISK_LABELS = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  heart_disease: 'Heart Disease',
}

const RISK_ICON = {
  low: IconCheckCircle,
  moderate: IconAlertTriangle,
  high: IconAlertOctagon,
}

function RiskCard({ conditionKey, risk, patientId }) {
  const [showWhy, setShowWhy] = useState(false)
  const [shapValues, setShapValues] = useState(null)
  const [shapLoading, setShapLoading] = useState(false)
  const [shapError, setShapError] = useState(null)
  const isElevated = risk.label === 'moderate' || risk.label === 'high'
  const StatusIcon = RISK_ICON[risk.label] || IconCheckCircle

  const handleToggleWhy = () => {
    const next = !showWhy
    setShowWhy(next)
    if (next && shapValues === null && !shapLoading) {
      setShapLoading(true)
      setShapError(null)
      getRiskExplanation(patientId, conditionKey)
        .then(setShapValues)
        .catch((err) => setShapError(err.message))
        .finally(() => setShapLoading(false))
    }
  }

  return (
    <div className={`risk-card ${risk.label}`}>
      <div className="risk-name">{RISK_LABELS[conditionKey] || conditionKey}</div>
      <RiskGauge score={risk.score * 100} />
      <div className="risk-label">
        <StatusIcon size={13} strokeWidth={2.2} />
        {risk.label} risk
      </div>
      {isElevated && (
        <>
          <button className={`btn-ghost why-toggle ${showWhy ? 'open' : ''}`} onClick={handleToggleWhy}>
            <IconChevronRight size={13} /> Why?
          </button>
          {showWhy && (
            <div className="why-panel">
              <ul className="why-list">
                {risk.factors.length > 0 ? (
                  risk.factors.map((factor, index) => <li key={index}>{factor}</li>)
                ) : (
                  <li>Multiple mild factors combine to elevate risk; no single dominant factor identified.</li>
                )}
              </ul>
              <div className="shap-section">
                <div className="chart-subhead">Model feature contributions (SHAP)</div>
                {shapLoading && <p className="empty-state">Loading…</p>}
                {shapError && <div className="error-banner">{shapError}</div>}
                {shapValues && <ShapFeatureBarChart shapValues={shapValues} />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function groupByCategory(conditions) {
  const groups = new Map()
  for (const condition of conditions) {
    if (!groups.has(condition.category)) groups.set(condition.category, [])
    groups.get(condition.category).push(condition)
  }
  return Array.from(groups.entries())
}

function ConditionGroup({ category, conditions }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="condition-group">
      <button className={`condition-group-toggle ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <IconChevronRight size={13} />
        {category} ({conditions.length})
      </button>
      {open && (
        <ul className="entry-list">
          {conditions.map((condition, index) => (
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
  )
}

function LabTrends({ patientId, labs }) {
  const [labKey, setLabKey] = useState(labs[0]?.key || '')
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!labKey) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getLabHistory(patientId, labKey)
      .then((data) => {
        if (!cancelled) setHistory(data)
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
  }, [patientId, labKey])

  if (labs.length === 0) {
    return <p className="empty-state">No lab values on file to trend.</p>
  }

  const selectedLabel = labs.find((lab) => lab.key === labKey)?.label || labKey
  const handleLabChange = (event) => {
    setHistory(null)
    setLabKey(event.target.value)
  }

  return (
    <div>
      <select value={labKey} onChange={handleLabChange} className="lab-trend-select">
        {labs.map((lab) => (
          <option key={lab.key} value={lab.key}>
            {lab.label}
          </option>
        ))}
      </select>
      {loading && <p className="empty-state">Loading trend…</p>}
      {error && <div className="error-banner">{error}</div>}
      {history && (
        <>
          <div className="chart-subhead">{selectedLabel} over time</div>
          <VitalsTrendChart data={history.map(({ date, value }) => ({ date, value }))} metricLabel={selectedLabel} />
          <div className="chart-subhead">Anomaly detection</div>
          <AnomalyHighlightChart data={history} />
        </>
      )}
    </div>
  )
}

function CohortComparison({ patientId, riskScores }) {
  const [target, setTarget] = useState(Object.keys(riskScores)[0] || 'diabetes')
  const [cohort, setCohort] = useState(null)
  const [cohortError, setCohortError] = useState(null)
  const [featureComparisons, setFeatureComparisons] = useState(null)
  const [featureError, setFeatureError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setCohort(null)
    setCohortError(null)
    getPatientCohort(patientId, target)
      .then((data) => {
        if (!cancelled) setCohort(data)
      })
      .catch((err) => {
        if (!cancelled) setCohortError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [patientId, target])

  useEffect(() => {
    let cancelled = false
    getCohortFeatureComparison(patientId)
      .then((data) => {
        if (!cancelled) setFeatureComparisons(data)
      })
      .catch((err) => {
        if (!cancelled) setFeatureError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  return (
    <div>
      <select value={target} onChange={(event) => setTarget(event.target.value)} className="lab-trend-select">
        {Object.keys(riskScores).map((key) => (
          <option key={key} value={key}>
            {RISK_LABELS[key] || key} risk
          </option>
        ))}
      </select>

      {cohortError && <div className="error-banner">{cohortError}</div>}
      {cohort === null && !cohortError && <p className="empty-state">Loading cohort…</p>}
      {cohort !== null && <CohortComparisonCard {...cohort} />}

      <div className="chart-subhead">How this patient compares on individual features</div>
      {featureError && <div className="error-banner">{featureError}</div>}
      {featureComparisons === null && !featureError && <p className="empty-state">Loading…</p>}
      {featureComparisons !== null && featureComparisons.length === 0 && (
        <p className="empty-state">Not enough similar patients yet for a feature comparison.</p>
      )}
      {featureComparisons !== null && featureComparisons.length > 0 && (
        <CohortFeatureDeltaTable comparisons={featureComparisons} />
      )}
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

  const [showActiveConditions, setShowActiveConditions] = useState(true)
  const [showInactiveConditions, setShowInactiveConditions] = useState(true)
  const [showActiveMedications, setShowActiveMedications] = useState(true)
  const [showInactiveMedications, setShowInactiveMedications] = useState(true)

  const [interactions, setInteractions] = useState(null)
  const [interactionsError, setInteractionsError] = useState(null)

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

  useEffect(() => {
    let cancelled = false
    setInteractions(null)
    setInteractionsError(null)
    getConditionInteractions(patientId)
      .then((data) => {
        if (!cancelled) setInteractions(data)
      })
      .catch((err) => {
        if (!cancelled) setInteractionsError(err.message)
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

  const radarConditions = Object.entries(patient.risk_scores).map(([key, risk]) => ({
    name: RISK_LABELS[key] || key,
    riskScore: risk.score * 100,
  }))

  const filteredConditions = patient.conditions.filter(
    (condition) => (condition.active && showActiveConditions) || (!condition.active && showInactiveConditions)
  )

  const filteredMedications = patient.medications.filter(
    (medication) => (medication.active && showActiveMedications) || (!medication.active && showInactiveMedications)
  )

  return (
    <div>
      <Link className="back-link" to="/">
        <IconArrowLeft size={15} /> Back to patient search
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
          <RiskCard key={key} conditionKey={key} risk={risk} patientId={patient.id} />
        ))}
      </div>

      <div className="section">
        <h3>
          <IconTarget size={17} /> Condition Risk Overview
        </h3>
        <RiskRadarChart conditions={radarConditions} />
      </div>

      <div className="section">
        <h3>
          <IconLink size={17} /> Condition Interactions
        </h3>
        {interactionsError && <div className="error-banner">{interactionsError}</div>}
        {interactions === null && !interactionsError && <p className="empty-state">Loading…</p>}
        {interactions !== null && (
          <PatientConditionInteractionPanel patientId={patient.id} interactions={interactions} />
        )}
      </div>

      <div className="section">
        <h3>
          <IconFlask size={17} /> Recent Labs
        </h3>
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
        <h3>
          <IconTrendingUp size={17} /> Lab Trends
        </h3>
        <LabTrends patientId={patient.id} labs={patient.labs} />
      </div>

      <div className="section">
        <h3>
          <IconUsers size={17} /> Cohort Comparison
        </h3>
        <CohortComparison patientId={patient.id} riskScores={patient.risk_scores} />
      </div>

      <div className="section">
        <h3>
          <IconSparkle size={17} /> AI Summary
        </h3>
        {!summary && (
          <button className="btn btn-primary" onClick={handleGenerateSummary} disabled={summaryLoading}>
            <IconSparkle size={15} />
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
        <h3>
          <IconClipboard size={17} /> Condition History ({filteredConditions.length})
        </h3>
        {patient.conditions.length > 0 && (
          <div className="condition-filters">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showActiveConditions}
                onChange={() => setShowActiveConditions(!showActiveConditions)}
              />
              Active
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showInactiveConditions}
                onChange={() => setShowInactiveConditions(!showInactiveConditions)}
              />
              Inactive
            </label>
          </div>
        )}
        {patient.conditions.length === 0 ? (
          <p className="empty-state">No conditions on file.</p>
        ) : filteredConditions.length === 0 ? (
          <p className="empty-state">No conditions match the current filters.</p>
        ) : (
          groupByCategory(filteredConditions).map(([category, conditions]) => (
            <ConditionGroup key={category} category={category} conditions={conditions} />
          ))
        )}
      </div>

      <div className="section">
        <h3>
          <IconPill size={17} /> Medications ({filteredMedications.length})
        </h3>
        {patient.medications.length > 0 && (
          <div className="condition-filters">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showActiveMedications}
                onChange={() => setShowActiveMedications(!showActiveMedications)}
              />
              Active
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showInactiveMedications}
                onChange={() => setShowInactiveMedications(!showInactiveMedications)}
              />
              Inactive
            </label>
          </div>
        )}
        {patient.medications.length === 0 ? (
          <p className="empty-state">No medications on file.</p>
        ) : filteredMedications.length === 0 ? (
          <p className="empty-state">No medications match the current filters.</p>
        ) : (
          <ul className="entry-list">
            {filteredMedications.map((medication, index) => (
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
