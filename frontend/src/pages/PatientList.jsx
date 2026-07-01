import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPatients } from '../api/client.js'

const PAGE_SIZE = 25

function PatientList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listPatients({ search, limit: PAGE_SIZE, offset })
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
  }, [search, offset])

  const handleSearchChange = (event) => {
    setOffset(0)
    setSearch(event.target.value)
  }

  return (
    <div>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search patients by name..."
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <table className="patient-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Sex</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr
              key={patient.id}
              className="patient-row"
              onClick={() => navigate(`/patients/${patient.id}`)}
            >
              <td>{patient.name}</td>
              <td>{patient.age}</td>
              <td>{patient.sex}</td>
              <td>
                {patient.city && patient.state ? `${patient.city}, ${patient.state}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!loading && patients.length === 0 && (
        <p className="empty-state">No patients match your search.</p>
      )}

      <div className="pagination">
        <button disabled={offset === 0} onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}>
          Previous
        </button>
        <span>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
        </span>
        <button
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
