import { useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import PatientList from './pages/PatientList.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import ComparePatients from './pages/ComparePatients.jsx'
import { IconPulse, IconUsers, IconX } from './icons.jsx'
import './App.css'

function App() {
  const [selectedIds, setSelectedIds] = useState([])
  const navigate = useNavigate()

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]))
  }

  const goToCompare = () => {
    navigate(`/compare?ids=${selectedIds.join(',')}`)
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <IconPulse size={17} strokeWidth={2.2} />
          </span>
          Vitalis
        </Link>
      </header>
      <main className="page">
        <Routes>
          <Route
            path="/"
            element={<PatientList selectedIds={selectedIds} onToggleSelect={toggleSelect} />}
          />
          <Route path="/patients/:patientId" element={<PatientDetail />} />
          <Route path="/compare" element={<ComparePatients />} />
        </Routes>
      </main>
      {selectedIds.length >= 2 && (
        <div className="compare-bar">
          <span>{selectedIds.length} patients selected</span>
          <button className="btn btn-primary btn-sm" onClick={goToCompare}>
            <IconUsers size={15} />
            Compare
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
            <IconX size={14} />
          </button>
        </div>
      )}
    </>
  )
}

export default App
