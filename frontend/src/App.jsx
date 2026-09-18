import { useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import PatientList from './pages/PatientList.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import ComparePatients from './pages/ComparePatients.jsx'
import CohortAnalytics from './pages/CohortAnalytics.jsx'
import AmbientBackground from './components/ui/AmbientBackground.jsx'
import EcgTrace from './components/ui/EcgTrace.jsx'
import { IconPulse, IconTarget, IconUsers, IconX } from './icons.jsx'
import './App.css'

const NAV_ITEMS = [
  { to: '/', label: 'Patients', icon: IconUsers, match: (path) => path === '/' || path.startsWith('/patients') || path === '/compare' },
  { to: '/analytics', label: 'Analytics', icon: IconTarget, match: (path) => path.startsWith('/analytics') },
]

function App() {
  const [selectedIds, setSelectedIds] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]))
  }

  const goToCompare = () => {
    navigate(`/compare?ids=${selectedIds.join(',')}`)
  }

  const activeIndex = NAV_ITEMS.findIndex((item) => item.match(location.pathname))

  return (
    <div className="app-shell">
      <AmbientBackground />

      <aside className="app-sidebar">
        <div className="sidebar-sheen" aria-hidden="true" />
        <Link to="/" className="brand">
          <span className="brand-mark">
            <IconPulse size={18} strokeWidth={2.4} />
          </span>
          <span className="brand-text">
            Vitalis
            <span className="brand-sub">Chronic risk intelligence</span>
          </span>
        </Link>
        <EcgTrace className="brand-ecg" />

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          {activeIndex >= 0 && (
            <span
              className="nav-indicator"
              style={{ transform: `translateY(${activeIndex * 48}px)` }}
              aria-hidden="true"
            />
          )}
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon
            const active = index === activeIndex
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="status-row">
            <span className="status-dot" aria-hidden="true" />
            <span>3 risk models online</span>
          </div>
          <div className="sidebar-note">Synthetic Synthea cohort — not real patient data.</div>
        </div>
      </aside>

      <div className="app-main">
        <main className="page">
          <div className="page-transition" key={location.pathname}>
            <Routes location={location}>
              <Route
                path="/"
                element={<PatientList selectedIds={selectedIds} onToggleSelect={toggleSelect} />}
              />
              <Route path="/patients/:patientId" element={<PatientDetail />} />
              <Route path="/compare" element={<ComparePatients />} />
              <Route path="/analytics" element={<CohortAnalytics />} />
            </Routes>
          </div>
        </main>
      </div>

      {selectedIds.length >= 2 && (
        <div className="compare-bar" role="status">
          <span className="compare-bar-count mono">{selectedIds.length}</span>
          <span>patients selected</span>
          <button className="btn btn-primary btn-sm" onClick={goToCompare}>
            <IconUsers size={15} />
            Compare side by side
          </button>
          <button
            className="btn btn-ghost btn-sm compare-bar-clear"
            onClick={() => setSelectedIds([])}
            aria-label="Clear selection"
          >
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default App
