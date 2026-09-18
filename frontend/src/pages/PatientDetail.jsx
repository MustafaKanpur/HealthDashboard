import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
  IconGrid,
  IconLightbulb,
  IconLink,
  IconPill,
  IconSparkle,
  IconStethoscope,
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
import { CONDITION_LABELS } from '../components/charts/chartTheme.js'
import Avatar from '../components/ui/Avatar.jsx'
import Card from '../components/ui/Card.jsx'
import Tabs from '../components/ui/Tabs.jsx'
import Skeleton, { SkeletonText } from '../components/ui/Skeleton.jsx'
import CountUp from '../components/ui/CountUp.jsx'

const RISK_ICON = {
  low: IconCheckCircle,
  moderate: IconAlertTriangle,
  high: IconAlertOctagon,
}

const SEVERITY = { low: 0, moderate: 1, high: 2 }

const TABS = [
  { id: 'overview', label: 'Overview', icon: IconGrid },
  { id: 'clinical', label: 'Clinical record', icon: IconStethoscope },
  { id: 'insights', label: 'Insights', icon: IconLightbulb },
]

function RiskCard({ conditionKey, risk, patientId, index }) {
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
    <div className={`risk-card ${risk.label} reveal`} style={{ '--i': index }}>
      <div className="risk-card-top">
        <div className="risk-name">{CONDITION_LABELS[conditionKey] || conditionKey}</div>
        <div className="risk-label">
          <StatusIcon size={13} strokeWidth={2.2} />
          {risk.label}
        </div>
      </div>
      <RiskGauge score={risk.score * 100} />
      {isElevated ? (
        <>
          <button className={`why-toggle ${showWhy ? 'open' : ''}`} onClick={handleToggleWhy} aria-expanded={showWhy}>
            Why this score
            <IconChevronRight size={14} />
          </button>
          <div className={`why-panel ${showWhy ? 'is-open' : ''}`} inert={showWhy ? undefined : ''}>
            <div className="why-panel-inner">
              <ul className="why-list">
                {risk.factors.length > 0 ? (
                  risk.factors.map((factor, factorIndex) => <li key={factorIndex}>{factor}</li>)
                ) : (
                  <li>Multiple mild factors combine to elevate risk; no single dominant factor identified.</li>
                )}
              </ul>
              <div className="shap-section">
                <div className="chart-subhead">Model feature contributions (SHAP)</div>
                {shapLoading && <SkeletonText lines={4} />}
                {shapError && <div className="error-banner">{shapError}</div>}
                {shapValues && <ShapFeatureBarChart shapValues={shapValues} />}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="risk-calm-note">No elevated risk factors flagged.</p>
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
    <div className={`condition-group ${open ? 'is-open' : ''}`}>
      <button className="condition-group-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <IconChevronRight size={14} />
        {category}
        <span className="count-pill mono">{conditions.length}</span>
      </button>
      <div className="condition-group-body" inert={open ? undefined : ''}>
        <div className="condition-group-inner">
          <ul className="entry-list">
            {conditions.map((condition, index) => (
              <li key={index}>
                <span>{condition.description}</span>
                <span className="entry-dates">
                  {condition.active ? (
                    <span className="badge-active">Active since {condition.start}</span>
                  ) : (
                    <span className="mono">
                      {condition.start} – {condition.stop}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function ActiveToggle({ showActive, showInactive, onToggleActive, onToggleInactive }) {
  return (
    <div className="toggle-group" role="group" aria-label="Show active or inactive entries">
      <button type="button" className={`toggle-chip ${showActive ? 'on' : ''}`} aria-pressed={showActive} onClick={onToggleActive}>
        Active
      </button>
      <button
        type="button"
        className={`toggle-chip ${showInactive ? 'on' : ''}`}
        aria-pressed={showInactive}
        onClick={onToggleInactive}
      >
        Inactive
      </button>
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

  return (
    <div>
      <div className="segmented segmented--wrap" role="radiogroup" aria-label="Lab to trend">
        {labs.map((lab) => (
          <button
            key={lab.key}
            type="button"
            role="radio"
            aria-checked={labKey === lab.key}
            className={`segmented-option ${labKey === lab.key ? 'selected' : ''}`}
            onClick={() => {
              setHistory(null)
              setLabKey(lab.key)
            }}
          >
            {lab.label}
          </button>
        ))}
      </div>
      {loading && !history && <Skeleton height={240} radius={12} style={{ marginTop: 16 }} />}
      {error && <div className="error-banner">{error}</div>}
      {history && (
        <div className="lab-trend-charts">
          <div>
            <div className="chart-subhead">{selectedLabel} over time</div>
            <VitalsTrendChart data={history.map(({ date, value }) => ({ date, value }))} metricLabel={selectedLabel} />
          </div>
          <div>
            <div className="chart-subhead">Anomaly detection</div>
            <AnomalyHighlightChart data={history} />
          </div>
        </div>
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
    <div className="cohort-layout">
      <div>
        <div className="segmented" role="radiogroup" aria-label="Risk to compare">
          {Object.keys(riskScores).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={target === key}
              className={`segmented-option ${target === key ? 'selected' : ''}`}
              onClick={() => setTarget(key)}
            >
              {CONDITION_LABELS[key] || key}
            </button>
          ))}
        </div>
        <div className="cohort-card-slot">
          {cohortError && <div className="error-banner">{cohortError}</div>}
          {cohort === null && !cohortError && <SkeletonText lines={5} />}
          {cohort !== null && <CohortComparisonCard key={target} {...cohort} />}
        </div>
      </div>
      <div>
        <div className="chart-subhead">How this patient differs from similar patients</div>
        {featureError && <div className="error-banner">{featureError}</div>}
        {featureComparisons === null && !featureError && <SkeletonText lines={6} />}
        {featureComparisons !== null && featureComparisons.length === 0 && (
          <p className="empty-state">Not enough similar patients yet for a feature comparison.</p>
        )}
        {featureComparisons !== null && featureComparisons.length > 0 && (
          <CohortFeatureDeltaTable comparisons={featureComparisons} />
        )}
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton width={150} height={14} style={{ marginBottom: 24 }} />
      <div className="card patient-hero">
        <Skeleton width={84} height={84} radius={999} />
        <div style={{ flex: 1 }}>
          <Skeleton width="40%" height={28} />
          <Skeleton width="60%" height={14} style={{ marginTop: 12 }} />
        </div>
      </div>
      <div className="risk-cards">
        {[0, 1, 2].map((index) => (
          <div key={index} className="risk-card">
            <Skeleton width="50%" height={12} />
            <Skeleton height={120} radius={12} style={{ marginTop: 16 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PatientDetail() {
  const { patientId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview'
  const setTab = (id) => setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })

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

  if (loading) return <DetailSkeleton />
  if (error) return <div className="error-banner">{error}</div>
  if (!patient) return null

  const riskEntries = Object.entries(patient.risk_scores)
  const [topKey, topRisk] = riskEntries.reduce(
    (best, entry) =>
      SEVERITY[entry[1].label] > SEVERITY[best[1].label] ||
      (SEVERITY[entry[1].label] === SEVERITY[best[1].label] && entry[1].score > best[1].score)
        ? entry
        : best,
    riskEntries[0]
  )
  const TopIcon = RISK_ICON[topRisk.label]

  const radarConditions = riskEntries.map(([key, risk]) => ({
    name: CONDITION_LABELS[key] || key,
    riskScore: risk.score * 100,
  }))

  const filteredConditions = patient.conditions.filter(
    (condition) => (condition.active && showActiveConditions) || (!condition.active && showInactiveConditions)
  )
  const filteredMedications = patient.medications.filter(
    (medication) => (medication.active && showActiveMedications) || (!medication.active && showInactiveMedications)
  )
  const activeConditionCount = patient.conditions.filter((condition) => condition.active).length
  const activeMedicationCount = new Set(
    patient.medications.filter((medication) => medication.active).map((medication) => medication.description)
  ).size

  return (
    <div>
      <Link className="back-link reveal" to="/">
        <IconArrowLeft size={15} /> Patient panel
      </Link>

      <section className="card patient-hero reveal" style={{ '--i': 1 }}>
        <div className={`hero-avatar tier-${topRisk.label}`}>
          <span className="hero-avatar-ring" aria-hidden="true" />
          <Avatar name={patient.name} size={76} />
        </div>
        <div className="hero-identity">
          <div className="eyebrow">Patient chart</div>
          <h1 className="hero-name">{patient.name}</h1>
          <div className="hero-chips">
            <span className="chip">
              <span className="mono">{patient.age}</span> years
            </span>
            <span className="chip">{patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : patient.sex}</span>
            {patient.race && <span className="chip chip--capitalize">{patient.race}</span>}
            <span className="chip">
              {patient.city && patient.state ? `${patient.city}, ${patient.state}` : 'Location unknown'}
            </span>
            {patient.deceased && <span className="chip chip--muted">Deceased</span>}
          </div>
        </div>
        <dl className="hero-stats">
          <div className="hero-stat">
            <dt>Highest risk</dt>
            <dd>
              <span className={`tier-badge ${topRisk.label}`}>
                <TopIcon size={13} strokeWidth={2.2} />
                {CONDITION_LABELS[topKey]}
              </span>
            </dd>
          </div>
          <div className="hero-stat">
            <dt>Active conditions</dt>
            <dd>
              <CountUp value={activeConditionCount} className="mono" />
            </dd>
          </div>
          <div className="hero-stat">
            <dt>Active medications</dt>
            <dd>
              <CountUp value={activeMedicationCount} className="mono" />
            </dd>
          </div>
        </dl>
      </section>

      <div className="tabs-row reveal" style={{ '--i': 2 }}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} idPrefix="patient" />
      </div>

      <div
        key={tab}
        className="tab-panel"
        role="tabpanel"
        id={`patient-panel-${tab}`}
        aria-labelledby={`patient-${tab}`}
      >
        {tab === 'overview' && (
          <>
            <div className="risk-cards">
              {riskEntries.map(([key, risk], index) => (
                <RiskCard key={key} conditionKey={key} risk={risk} patientId={patient.id} index={index} />
              ))}
            </div>
            <div className="grid-2">
              <Card icon={IconTarget} title="Risk profile" hint="All three conditions at a glance" index={3}>
                <RiskRadarChart conditions={radarConditions} />
              </Card>
              <Card
                icon={IconLink}
                title="Compounding factors"
                hint="Features driving more than one elevated condition"
                index={4}
              >
                {interactionsError && <div className="error-banner">{interactionsError}</div>}
                {interactions === null && !interactionsError && <SkeletonText lines={4} />}
                {interactions !== null && (
                  <PatientConditionInteractionPanel patientId={patient.id} interactions={interactions} />
                )}
              </Card>
            </div>
          </>
        )}

        {tab === 'clinical' && (
          <>
            <Card icon={IconFlask} title="Recent labs" hint="Most recent value of each measured lab" index={0}>
              {patient.labs.length === 0 ? (
                <p className="empty-state">No lab values on file.</p>
              ) : (
                <div className="lab-grid">
                  {patient.labs.map((lab, index) => (
                    <div className="lab-item reveal" key={lab.key} style={{ '--i': index + 1 }}>
                      <div className="lab-label">{lab.label}</div>
                      <div className="lab-value">
                        {lab.value}
                        <span className="lab-unit">{lab.unit || ''}</span>
                      </div>
                      <div className="lab-date">{lab.observed_on}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card icon={IconTrendingUp} title="Lab trends" hint="History and statistical outliers for one lab" index={1}>
              <LabTrends patientId={patient.id} labs={patient.labs} />
            </Card>

            <div className="grid-2">
              <Card
                icon={IconClipboard}
                title="Condition history"
                hint={`${filteredConditions.length} of ${patient.conditions.length} shown`}
                index={2}
                actions={
                  patient.conditions.length > 0 && (
                    <ActiveToggle
                      showActive={showActiveConditions}
                      showInactive={showInactiveConditions}
                      onToggleActive={() => setShowActiveConditions(!showActiveConditions)}
                      onToggleInactive={() => setShowInactiveConditions(!showInactiveConditions)}
                    />
                  )
                }
              >
                {patient.conditions.length === 0 ? (
                  <p className="empty-state">No conditions on file.</p>
                ) : filteredConditions.length === 0 ? (
                  <p className="empty-state">No conditions match the current filters.</p>
                ) : (
                  groupByCategory(filteredConditions).map(([category, conditions]) => (
                    <ConditionGroup key={category} category={category} conditions={conditions} />
                  ))
                )}
              </Card>

              <Card
                icon={IconPill}
                title="Medications"
                hint={`${filteredMedications.length} of ${patient.medications.length} shown`}
                index={3}
                actions={
                  patient.medications.length > 0 && (
                    <ActiveToggle
                      showActive={showActiveMedications}
                      showInactive={showInactiveMedications}
                      onToggleActive={() => setShowActiveMedications(!showActiveMedications)}
                      onToggleInactive={() => setShowInactiveMedications(!showInactiveMedications)}
                    />
                  )
                }
              >
                {patient.medications.length === 0 ? (
                  <p className="empty-state">No medications on file.</p>
                ) : filteredMedications.length === 0 ? (
                  <p className="empty-state">No medications match the current filters.</p>
                ) : (
                  <ul className="entry-list entry-list--flush">
                    {filteredMedications.map((medication, index) => (
                      <li key={index}>
                        <span>{medication.description}</span>
                        <span className="entry-dates">
                          {medication.active ? (
                            <span className="badge-active">Active since {medication.start}</span>
                          ) : (
                            <span className="mono">
                              {medication.start} – {medication.stop}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}

        {tab === 'insights' && (
          <>
            <Card
              icon={IconUsers}
              title="Cohort comparison"
              hint="How this patient's risk compares to clinically similar patients (KMeans cohort)"
              index={0}
            >
              <CohortComparison patientId={patient.id} riskScores={patient.risk_scores} />
            </Card>

            <Card
              icon={IconSparkle}
              title="AI chart summary"
              hint="A plain-language pre-visit summary generated by Claude"
              index={1}
              className="ai-card"
            >
              {!summary && !summaryLoading && (
                <div className="ai-cta">
                  <p>Condense this chart — conditions, labs, medications and risk scores — into a two-minute read.</p>
                  <button className="btn btn-primary" onClick={handleGenerateSummary}>
                    <IconSparkle size={15} />
                    Generate summary
                  </button>
                </div>
              )}
              {summaryLoading && (
                <div className="ai-generating">
                  <span className="ai-orb" aria-hidden="true" />
                  <div style={{ flex: 1 }}>
                    <div className="ai-generating-label">Reading the chart…</div>
                    <SkeletonText lines={4} />
                  </div>
                </div>
              )}
              {summaryError && <div className="error-banner">{summaryError}</div>}
              {summary && (
                <div className="summary-box reveal">
                  <p>{summary.summary}</p>
                  {summary.recommendations.length > 0 && (
                    <>
                      <div className="chart-subhead">Suggested considerations</div>
                      <ul>
                        {summary.recommendations.map((rec, index) => (
                          <li key={index} className="reveal" style={{ '--i': index }}>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default PatientDetail
