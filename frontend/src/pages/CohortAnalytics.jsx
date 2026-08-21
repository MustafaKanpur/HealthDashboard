import { useEffect, useState } from 'react'
import { getConditionCorrelation } from '../api/client.js'
import { IconTarget } from '../icons.jsx'
import ConditionCorrelationHeatmap from '../components/charts/ConditionCorrelationHeatmap.jsx'

function CohortAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getConditionCorrelation()
      .then((result) => {
        if (!cancelled) setData(result)
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
  }, [])

  return (
    <div>
      <h1 className="page-title">Cohort Analytics</h1>
      <div className="section">
        <h3>
          <IconTarget size={17} /> Condition Risk Correlation
        </h3>
        {loading && <p className="empty-state">Loading cohort data…</p>}
        {error && <div className="error-banner">{error}</div>}
        {data && !data.sufficientData && (
          <p className="empty-state">
            Not enough scored patients yet ({data.nPatients} so far) for a meaningful correlation. Check back once
            the panel grows.
          </p>
        )}
        {data && data.sufficientData && (
          <>
            <p className="chart-subhead">
              Across {data.nPatients} scored patients, Spearman rank correlation between conditions' predicted risk
              scores.
            </p>
            <ConditionCorrelationHeatmap conditions={data.conditions} matrix={data.matrix} />
          </>
        )}
      </div>
    </div>
  )
}

export default CohortAnalytics
