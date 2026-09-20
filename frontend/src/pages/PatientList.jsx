import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPanelSummary, getRiskSummary, listConditionCategories, listPatients } from '../api/client.js'
import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconSliders,
  IconTrendingUp,
  IconX,
} from '../icons.jsx'
import PatientTableSparklines from '../components/charts/PatientTableSparklines.jsx'
import RiskDistributionHistogram from '../components/charts/RiskDistributionHistogram.jsx'
import RiskScatterPlot from '../components/charts/RiskScatterPlot.jsx'
import { CONDITION_LABELS } from '../components/charts/chartTheme.js'
import PageHero from '../components/ui/PageHero.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'

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

// ISO date, matching how every other date in the record is printed.
const REPORT_DATE = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })

/** One key/value pair in the panel header strip. */
function DataCell({ label, marker, value, share }) {
  return (
    <div className="data-cell">
      <span className="data-key">
        {marker && <span className="data-key-marker" aria-hidden="true" />}
        {label}
      </span>
      <span className="data-val mono">
        {value}
        {share !== undefined && <span className="data-aside">{share}%</span>}
      </span>
      {share !== undefined && (
        <span className="data-meter" aria-hidden="true">
          <span style={{ width: `${share}%` }} />
        </span>
      )}
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
    <section className="data-strip reveal" aria-label="Panel summary" style={{ '--i': 1 }}>
      <DataCell
        label="Patients in panel"
        value={summary ? summary.total.toLocaleString() : <Skeleton width={64} height={20} radius={0} />}
      />
      {TARGET_KEYS.map((target) => (
        <DataCell
          key={target}
          marker
          label={`High risk · ${CONDITION_LABELS[target]}`}
          value={summary ? summary.high[target].toLocaleString() : <Skeleton width={48} height={20} radius={0} />}
          share={summary ? Math.round((summary.high[target] / summary.total) * 100) : undefined}
        />
      ))}
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
          {loading && !points && <Skeleton height={220} radius={0} />}
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
      <td className="col-check">
        <Skeleton width={14} height={14} radius={0} />
      </td>
      <td>
        <div className="patient-cell">
          <Skeleton width={24} height={24} radius={999} />
          <Skeleton width={130} height={11} radius={0} />
        </div>
      </td>
      <td className="col-place">
        <Skeleton width={110} height={11} radius={0} />
      </td>
      <td className="col-num">
        <Skeleton width={22} height={11} radius={0} />
      </td>
      <td className="col-sex">
        <Skeleton width={14} height={11} radius={0} />
      </td>
      <td className="col-trend">
        <Skeleton width={80} height={16} radius={0} />
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
        meta={
          <>
            Panel as of <span className="mono">{REPORT_DATE}</span>
          </>
        }
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
              <th className="col-place">Location</th>
              <th className="col-num">Age</th>
              <th className="col-sex">Sex</th>
              <th className="col-trend">Glucose trend</th>
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
                        <Avatar name={patient.name} size={24} />
                        <span className="patient-name">{patient.name}</span>
                      </div>
                    </td>
                    <td className="col-place">
                      {patient.city && patient.state ? `${patient.city}, ${patient.state}` : '—'}
                    </td>
                    <td className="col-num">{patient.age}</td>
                    <td className="col-sex">{patient.sex}</td>
                    <td className="col-trend">
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
