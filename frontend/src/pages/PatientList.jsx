import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPanelSummary, getRiskSummary, listConditionCategories, listPatients } from '../api/client.js'
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconSliders,
  IconTrendingUp,
  IconUsers,
  IconX,
} from '../icons.jsx'
import PatientTableSparklines from '../components/charts/PatientTableSparklines.jsx'
import RiskDistributionHistogram from '../components/charts/RiskDistributionHistogram.jsx'
import RiskScatterPlot from '../components/charts/RiskScatterPlot.jsx'
import { CONDITION_LABELS } from '../components/charts/chartTheme.js'
import PageHero from '../components/ui/PageHero.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'
import CountUp, { useCountUp } from '../components/ui/CountUp.jsx'

const PAGE_SIZE = 25
const TARGET_KEYS = Object.keys(CONDITION_LABELS)

const RISK_TARGETS = [
  { value: '', label: 'Any condition' },
  ...TARGET_KEYS.map((key) => ({ value: key, label: CONDITION_LABELS[key] })),
]

const RISK_LEVELS = [
  { value: '', label: 'Any risk level' },
  { value: 'moderate', label: 'Moderate or higher' },
  { value: 'high', label: 'High only' },
]

const SMOKING_OPTIONS = [
  { value: '', label: 'Any smoking status' },
  { value: 'Never smoker', label: 'Never smoker' },
  { value: 'Former smoker', label: 'Former smoker' },
  { value: 'Current every day smoker', label: 'Current smoker' },
]

const EMPTY_FILTERS = {
  sex: '',
  minAge: '',
  maxAge: '',
  conditionCategory: '',
  medication: '',
  smokingStatus: '',
  riskTarget: '',
  riskMinLabel: '',
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function RingTile({ label, count, total, index }) {
  const fraction = total ? count / total : 0
  const animated = useCountUp(fraction, 1100)
  return (
    <div className="kpi-tile reveal" style={{ '--i': index }}>
      <svg className="kpi-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" className="kpi-ring-track" />
        <circle
          cx="22"
          cy="22"
          r="18"
          className="kpi-ring-fill"
          pathLength="1"
          strokeDasharray={`${animated} 1`}
        />
      </svg>
      <div>
        <div className="kpi-label">
          <span className="kpi-risk-dot" aria-hidden="true" />
          High risk · {label}
        </div>
        <div className="kpi-value">
          <CountUp value={count} className="mono" />
          <span className="kpi-share mono">{Math.round(fraction * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

function PanelKpis() {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    getPanelSummary()
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (summary === false) return null

  return (
    <section className="kpi-strip" aria-label="Panel summary">
      <div className="kpi-tile kpi-tile--primary reveal" style={{ '--i': 0 }}>
        <span className="kpi-icon" aria-hidden="true">
          <IconUsers size={20} />
        </span>
        <div>
          <div className="kpi-label">Patients in panel</div>
          <div className="kpi-value">
            {summary ? <CountUp value={summary.total} className="mono" /> : <Skeleton width={72} height={26} />}
          </div>
        </div>
      </div>
      {TARGET_KEYS.map((target, index) =>
        summary ? (
          <RingTile
            key={target}
            label={CONDITION_LABELS[target]}
            count={summary.high[target]}
            total={summary.total}
            index={index + 1}
          />
        ) : (
          <div key={target} className="kpi-tile reveal" style={{ '--i': index + 1 }}>
            <Skeleton width={44} height={44} radius={999} />
            <div style={{ flex: 1 }}>
              <Skeleton width="70%" height={11} />
              <Skeleton width={60} height={24} style={{ marginTop: 8 }} />
            </div>
          </div>
        )
      )}
    </section>
  )
}

function PanelOverview({ search, filters }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState(TARGET_KEYS[0])
  const [points, setPoints] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getRiskSummary({ ...filters, search, riskTarget: target })
      .then((data) => {
        if (!cancelled) setPoints(data)
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
  }, [open, target, search, filters])

  return (
    <section className={`card collapsible reveal ${open ? 'is-open' : ''}`} style={{ '--i': 3 }}>
      <button className="collapsible-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="card-title-icon" aria-hidden="true">
          <IconTrendingUp size={16} />
        </span>
        <span className="collapsible-title">
          Panel overview
          <span className="collapsible-hint">Risk distribution and age patterns for the current filters</span>
        </span>
        <IconChevronRight size={16} className="collapsible-chevron" />
      </button>
      <div className="collapsible-body" inert={open ? undefined : ''}>
        <div className="collapsible-inner">
          <div className="panel-overview-controls">
            <div className="segmented" role="radiogroup" aria-label="Risk target">
              {TARGET_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={target === key}
                  className={`segmented-option ${target === key ? 'selected' : ''}`}
                  onClick={() => setTarget(key)}
                >
                  {CONDITION_LABELS[key]}
                </button>
              ))}
            </div>
            {points && <span className="panel-overview-count mono">{points.length.toLocaleString()} patients</span>}
          </div>
          {loading && !points && <Skeleton height={220} radius={12} />}
          {error && <div className="error-banner">{error}</div>}
          {points && (
            <div className="panel-overview-charts">
              <div>
                <div className="chart-subhead">Risk distribution</div>
                <RiskDistributionHistogram patients={points.map((point) => ({ riskScore: point.risk_score }))} />
              </div>
              <div>
                <div className="chart-subhead">Age vs. risk</div>
                <RiskScatterPlot
                  data={points.map((point) => ({
                    x: point.age,
                    y: point.risk_score,
                    tier: point.tier,
                    patientId: point.patient_id,
                  }))}
                  xLabel="Age"
                  yLabel="Risk Score"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function FilterPanel({ open, filters, categories, onChange }) {
  return (
    <div className={`filter-drawer ${open ? 'is-open' : ''}`} inert={open ? undefined : ''}>
      <div className="filter-drawer-inner">
        <div className="filter-panel">
          <fieldset className="filter-group">
            <legend>Demographics</legend>
            <div className="filter-row">
              <select value={filters.sex} onChange={(e) => onChange('sex', e.target.value)} aria-label="Sex">
                <option value="">Any sex</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
              <input
                type="number"
                placeholder="Min age"
                min="0"
                value={filters.minAge}
                onChange={(e) => onChange('minAge', e.target.value)}
                aria-label="Minimum age"
              />
              <span className="filter-dash" aria-hidden="true">
                –
              </span>
              <input
                type="number"
                placeholder="Max age"
                min="0"
                value={filters.maxAge}
                onChange={(e) => onChange('maxAge', e.target.value)}
                aria-label="Maximum age"
              />
            </div>
          </fieldset>
          <fieldset className="filter-group">
            <legend>Clinical</legend>
            <div className="filter-row">
              <select
                value={filters.conditionCategory}
                onChange={(e) => onChange('conditionCategory', e.target.value)}
                aria-label="Condition category"
              >
                <option value="">Any condition category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Medication contains…"
                value={filters.medication}
                onChange={(e) => onChange('medication', e.target.value)}
                aria-label="Medication"
              />
              <select
                value={filters.smokingStatus}
                onChange={(e) => onChange('smokingStatus', e.target.value)}
                aria-label="Smoking status"
              >
                {SMOKING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          <fieldset className="filter-group">
            <legend>Predicted risk</legend>
            <div className="filter-row">
              <select value={filters.riskTarget} onChange={(e) => onChange('riskTarget', e.target.value)} aria-label="Risk condition">
                {RISK_TARGETS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.riskMinLabel}
                onChange={(e) => onChange('riskMinLabel', e.target.value)}
                aria-label="Minimum risk level"
              >
                {RISK_LEVELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  )
}

function SkeletonRows() {
  return Array.from({ length: 8 }, (_, index) => (
    <tr key={index} className="skeleton-row">
      <td>
        <Skeleton width={16} height={16} radius={4} />
      </td>
      <td>
        <div className="patient-cell">
          <Skeleton width={36} height={36} radius={999} />
          <div style={{ flex: 1 }}>
            <Skeleton width="55%" height={12} />
            <Skeleton width="35%" height={10} style={{ marginTop: 6 }} />
          </div>
        </div>
      </td>
      <td>
        <Skeleton width={28} height={12} />
      </td>
      <td>
        <Skeleton width={22} height={20} radius={999} />
      </td>
      <td>
        <Skeleton width={80} height={20} />
      </td>
      <td />
    </tr>
  ))
}

function PatientList({ selectedIds, onToggleSelect }) {
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters])

  useEffect(() => {
    listConditionCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]))
  }, [])

  // "/" focuses search from anywhere on the page, like most search-first tools.
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target.tagName
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0)
      setSearch(searchInput)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listPatients({ search, ...filters, limit: PAGE_SIZE, offset })
      .then((data) => {
        if (cancelled) return
        setTotal(data.total)
        setPatients(data.patients)
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
  }, [search, filters, offset])

  const updateFilter = (key, value) => {
    setOffset(0)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setOffset(0)
    setSearchInput('')
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  const openPatient = (id) => navigate(`/patients/${id}`)
  const firstLoad = loading && patients.length === 0

  return (
    <div>
      <PageHero
        eyebrow={`${greeting()} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`}
        title="Patient panel"
        subtitle="Search the panel, open a chart, or select two or more patients to compare them side by side."
      />

      <PanelKpis />

      <div className="toolbar reveal" style={{ '--i': 2 }}>
        <div className="search-bar">
          <span className="field-icon">
            <IconSearch size={17} />
          </span>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search patients by name"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search patients by name"
          />
          {searchInput ? (
            <button className="search-clear" onClick={() => setSearchInput('')} aria-label="Clear search">
              <IconX size={14} />
            </button>
          ) : (
            <kbd className="kbd">/</kbd>
          )}
        </div>
        <button
          className={`btn toolbar-btn ${filtersOpen ? 'is-active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
        >
          <IconSliders size={16} />
          Filters
          {activeFilterCount > 0 && <span className="count-badge mono">{activeFilterCount}</span>}
        </button>
        {(activeFilterCount > 0 || searchInput) && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>

      <FilterPanel open={filtersOpen} filters={filters} categories={categories} onChange={updateFilter} />

      <PanelOverview search={search} filters={filters} />

      {error && <div className="error-banner">{error}</div>}

      <section className={`card table-card reveal ${loading && !firstLoad ? 'is-refreshing' : ''}`} style={{ '--i': 4 }}>
        <table className="patient-table">
          <thead>
            <tr>
              <th className="col-check">
                <span className="visually-hidden">Select</span>
              </th>
              <th>Patient</th>
              <th>Age</th>
              <th>Sex</th>
              <th>Glucose trend</th>
              <th className="col-chevron">
                <span className="visually-hidden">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {firstLoad ? (
              <SkeletonRows />
            ) : (
              patients.map((patient, index) => {
                const selected = selectedIds.includes(patient.id)
                return (
                  <tr
                    key={patient.id}
                    className={`patient-row ${selected ? 'is-selected' : ''}`}
                    style={{ '--i': Math.min(index, 14) }}
                    tabIndex={0}
                    onClick={() => openPatient(patient.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') openPatient(patient.id)
                    }}
                  >
                    <td className="col-check" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(patient.id)}
                        aria-label={`Select ${patient.name} for comparison`}
                      />
                    </td>
                    <td>
                      <div className="patient-cell">
                        <Avatar name={patient.name} />
                        <div>
                          <div className="patient-name">{patient.name}</div>
                          <div className="patient-sub">
                            {patient.city && patient.state ? `${patient.city}, ${patient.state}` : 'Location unknown'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{patient.age}</td>
                    <td>
                      <span className="chip">{patient.sex}</span>
                    </td>
                    <td>
                      <PatientTableSparklines values={patient.glucose_trend} />
                    </td>
                    <td className="col-chevron">
                      <IconChevronRight size={16} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {!loading && patients.length === 0 && (
          <div className="empty-panel">
            <span className="empty-panel-icon" aria-hidden="true">
              <IconSearch size={22} />
            </span>
            <div className="empty-panel-title">No patients match</div>
            <div className="empty-panel-text">Try a different name, or clear some filters.</div>
          </div>
        )}

        <div className="pagination">
          <span>
            Showing{' '}
            <span className="mono">
              {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)}
            </span>{' '}
            of <span className="mono">{total.toLocaleString()}</span>
          </span>
          <div className="pagination-buttons">
            <button
              className="btn btn-icon"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
              aria-label="Previous page"
            >
              <IconChevronLeft size={16} />
            </button>
            <button
              className="btn btn-icon"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              aria-label="Next page"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default PatientList
