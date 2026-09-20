import { useEffect, useState } from 'react'
import { getConditionCorrelation } from '../api/client.js'
import { IconLightbulb, IconTarget } from '../icons.jsx'
import ConditionCorrelationHeatmap from '../components/charts/ConditionCorrelationHeatmap.jsx'
import { CONDITION_LABELS } from '../components/charts/chartTheme.js'
import PageHero from '../components/ui/PageHero.jsx'
import Card from '../components/ui/Card.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'
import CountUp from '../components/ui/CountUp.jsx'

function strongestPair(conditions, matrix) {
  let best = null
  for (let row = 0; row < conditions.length; row += 1) {
    for (let col = row + 1; col < conditions.length; col += 1) {
      const value = matrix[row][col]
      if (!best || Math.abs(value) > Math.abs(best.value)) best = { a: conditions[row], b: conditions[col], value }
    }
  }
  return best
}

function describeStrength(r) {
  const magnitude = Math.abs(r)
  if (magnitude < 0.1) return 'negligible'
  if (magnitude < 0.3) return 'weak'
  if (magnitude < 0.5) return 'moderate'
  return 'strong'
}

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

  const pair = data?.sufficientData ? strongestPair(data.conditions, data.matrix) : null
  const label = (key) => CONDITION_LABELS[key] || key

  return (
    <div>
      <PageHero
        meta="Population analytics"
        title="How conditions move together"
        subtitle="Across the whole panel, does elevated risk for one condition travel with elevated risk for another?"
      />

      {error && <div className="error-banner">{error}</div>}

      {pair && (
        <section className="insight-banner reveal" style={{ '--i': 1 }}>
          <span className="insight-icon" aria-hidden="true">
            <IconLightbulb size={18} />
          </span>
          <p>
            <strong>{label(pair.a)}</strong> and <strong>{label(pair.b)}</strong> risk{' '}
            {pair.value >= 0 ? 'move together' : 'move in opposite directions'} more than any other pair — a{' '}
            {describeStrength(pair.value)} relationship <span className="mono">(r = {pair.value.toFixed(2)})</span>{' '}
            across <CountUp value={data.nPatients} className="mono" /> scored patients.
          </p>
        </section>
      )}

      <Card
        icon={IconTarget}
        title="Condition risk correlation"
        hint="Spearman rank correlation between each pair of predicted risk scores"
        index={2}
      >
        {loading && <Skeleton height={320} radius={12} />}
        {data && !data.sufficientData && (
          <p className="empty-state">
            Not enough scored patients yet ({data.nPatients} so far) for a meaningful correlation. Check back once the
            panel grows.
          </p>
        )}
        {data && data.sufficientData && (
          <div className="analytics-layout">
            <ConditionCorrelationHeatmap conditions={data.conditions} matrix={data.matrix} />
            <aside className="analytics-legend">
              <div className="chart-subhead">Reading the matrix</div>
              <div className="diverging-legend" aria-hidden="true" />
              <div className="diverging-legend-labels mono">
                <span>−1</span>
                <span>0</span>
                <span>+1</span>
              </div>
              <ul className="legend-notes">
                <li>
                  <strong>Deeper blue</strong> — risks rise together across patients.
                </li>
                <li>
                  <strong>Slate</strong> — one tends to fall as the other rises.
                </li>
                <li>
                  {/* Weak cells blend into the sheet, which is white in light
                      mode and near-black in dark — so name the behaviour,
                      not the color. */}
                  <strong>Faintest cells</strong> — little relationship.
                </li>
              </ul>
              <p className="legend-footnote">
                Correlation describes the population, not causation, and says nothing about any single patient.
              </p>
            </aside>
          </div>
        )}
      </Card>
    </div>
  )
}

export default CohortAnalytics
