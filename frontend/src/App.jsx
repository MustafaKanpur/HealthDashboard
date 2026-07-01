import { Link, Route, Routes } from 'react-router-dom'
import PatientList from './pages/PatientList.jsx'
import PatientDetail from './pages/PatientDetail.jsx'
import './App.css'

function App() {
  return (
    <>
      <header className="app-header">
        <Link to="/">Clinician Chronic Disease Risk Dashboard</Link>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<PatientList />} />
          <Route path="/patients/:patientId" element={<PatientDetail />} />
        </Routes>
      </main>
    </>
  )
}

export default App
