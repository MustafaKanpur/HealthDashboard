import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRiskSummary, listConditionCategories, listPatients } from '../api/client.js'
import { IconChevronRight, IconFilter, IconSearch, IconTrendingUp } from '../icons.jsx'
import PatientTableSparklines from '../components/charts/PatientTableSparklines.jsx'
import RiskDistributionHistogram from '../components/charts/RiskDistributionHistogram.jsx'
import RiskScatterPlot from '../components/charts/RiskScatterPlot.jsx'

const PAGE_SIZE = 25

const RISK_TARGETS = [
  { value: '', label: 'Any condition' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'heart_disease', label: 'Heart Disease' },
]

const RISK_LEVELS = [
  { value: '', label: 'Any risk' },
  { value: 'moderate', label: 'Moderate+' },
  { value: 'high', label: 'High' },
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

function PanelOverview({ search, filters }) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('diabetes')
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
    <div className="section">
      <button className={`condition-group-toggle ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <IconChevronRight size={13} />
        <IconTrendingUp size={16} /> Panel Overview
      </button>
      {open && (
        <div className="panel-overview-body">
          <div className="panel-overview-controls">
            <span className="filter-panel-label">Risk target</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              {RISK_TARGETS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {points && <span className="panel-overview-count">{points.length} patients in current filters</span>}
          </div>
          {loading && <p className="empty-state">Loading panel data…</p>}
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
      )}
    </div>
  )
}

function PatientList({ selectedIds, onToggleSelect }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [categories, setCategories] = useState([])
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listConditionCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]))
  }, [])

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
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  return (
    <div>
      <h1 className="page-title">Patients</h1>
      <div className="search-bar">
        <span className="field-icon">
          <IconSearch size={16} />
        </span>
        <input
          type="text"
          placeholder="Search patients by name..."
          value={search}
          onChange={(event) => {
            setOffset(0)
            setSearch(event.target.value)
          }}
        />
      </div>

      <div className="filter-panel">
        <span className="filter-panel-label">
          <IconFilter size={13} />
          Filters
        </span>
        <select value={filters.sex} onChange={(e) => updateFilter('sex', e.target.value)}>
          <option value="">Any sex</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
        </select>
        <input
          type="number"
          placeholder="Min age"
          min="0"
          value={filters.minAge}
          onChange={(e) => updateFilter('minAge', e.target.value)}
        />
        <input
          type="number"
          placeholder="Max age"
          min="0"
          value={filters.maxAge}
          onChange={(e) => updateFilter('maxAge', e.target.value)}
        />
        <select
          value={filters.conditionCategory}
          onChange={(e) => updateFilter('conditionCategory', e.target.value)}
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
          placeholder="Medication contains..."
          value={filters.medication}
          onChange={(e) => updateFilter('medication', e.target.value)}
        />
        <select value={filters.smokingStatus} onChange={(e) => updateFilter('smokingStatus', e.target.value)}>
          {SMOKING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select value={filters.riskTarget} onChange={(e) => updateFilter('riskTarget', e.target.value)}>
          {RISK_TARGETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select value={filters.riskMinLabel} onChange={(e) => updateFilter('riskMinLabel', e.target.value)}>
          {RISK_LEVELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      <PanelOverview search={search} filters={filters} />

      {error && <div className="error-banner">{error}</div>}

      <table className="patient-table">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Age</th>
            <th>Sex</th>
            <th>Location</th>
            <th>Glucose Trend</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id} className="patient-row">
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(patient.id)}
                  onChange={() => onToggleSelect(patient.id)}
                />
              </td>
              <td onClick={() => navigate(`/patients/${patient.id}`)}>{patient.name}</td>
              <td onClick={() => navigate(`/patients/${patient.id}`)}>{patient.age}</td>
              <td onClick={() => navigate(`/patients/${patient.id}`)}>{patient.sex}</td>
              <td onClick={() => navigate(`/patients/${patient.id}`)}>
                {patient.city && patient.state ? `${patient.city}, ${patient.state}` : '—'}
              </td>
              <td onClick={() => navigate(`/patients/${patient.id}`)}>
                <PatientTableSparklines values={patient.glucose_trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!loading && patients.length === 0 && (
        <p className="empty-state">No patients match your search.</p>
      )}

      <div className="pagination">
        <button className="btn btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}>
          Previous
        </button>
        <span>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
        </span>
        <button
          className="btn btn-sm"
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default PatientList
