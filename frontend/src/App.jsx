import { useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import PatientList from './pages/PatientList.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import ComparePatients from './pages/ComparePatients.jsx'
import CohortAnalytics from './pages/CohortAnalytics.jsx'
import { useTheme } from './components/ui/useTheme.js'
import { PageTitleProvider, usePageTitleState } from './components/ui/pageTitle.jsx'
import { IconGithub, IconMoon, IconSun, IconTarget, IconUsers, IconX } from './icons.jsx'
import './App.css'

const REPO_URL = 'https://github.com/MustafaKanpur/HealthDashboard'

const NAV_ITEMS = [
  { to: '/', label: 'Patients', icon: IconUsers, match: (path) => path === '/' || path.startsWith('/patients') || path === '/compare' },
  { to: '/analytics', label: 'Analytics', icon: IconTarget, match: (path) => path.startsWith('/analytics') },
]

function App() {
  const [selectedIds, setSelectedIds] = useState([])
  const [theme, toggleTheme] = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark = theme === 'dark'
  const [pageTitle, setPageTitle] = usePageTitleState(location.pathname)

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]))
  }

  const goToCompare = () => {
    navigate(`/compare?ids=${selectedIds.join(',')}`)
  }

  const activeIndex = NAV_ITEMS.findIndex((item) => item.match(location.pathname))

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-head">
          <Link to="/" className="brand">
            <span className="brand-name">Vitalis</span>
            <span className="brand-sub">Chronic risk intelligence</span>
          </Link>
          <a
            className="sidebar-link"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View the source on GitHub (opens in a new tab)"
            title="View the source on GitHub"
          >
            <IconGithub size={17} />
          </a>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
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
        <header className="app-topbar">
          <div className="app-topbar-inner">
            {/* Repeats the page's own heading, so it's decoration for a
                screen reader, which already has the h1 below. */}
            <span className="topbar-title" aria-hidden="true">
              {pageTitle}
            </span>
            <button
              type="button"
              className="topbar-action theme-toggle"
              onClick={toggleTheme}
              aria-pressed={isDark}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
          </div>
        </header>

        <main className="page">
          <PageTitleProvider setPageTitle={setPageTitle}>
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
          </PageTitleProvider>
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
