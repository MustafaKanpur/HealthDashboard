import ChartEmptyState from './ChartEmptyState.jsx'

// %-difference magnitude that fills the bar track fully, so one extreme
// outlier feature doesn't compress every other bar to a sliver.
const MAX_BAR_PERCENT = 100

/** One row per feature: patient value vs. cohort average, with a bar whose
 * length scales with |percentDifference| — blue when the patient is above
 * the cohort average, slate when below (direction isn't "good/bad" without
 * clinical context, so this deliberately isn't a risk-tier color). */
function CohortFeatureDeltaTable({ comparisons }) {
  if (!comparisons || comparisons.length === 0) {
    return <ChartEmptyState message="No cohort feature comparison available" height={140} />
  }

  return (
    <table className="feature-delta-table">
      <thead>
        <tr>
          <th>Feature</th>
          <th>Patient</th>
          <th>Cohort avg</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>
        {comparisons.map((comparison) => {
          const magnitude = Math.min(Math.abs(comparison.percentDifference), MAX_BAR_PERCENT)
          const widthPercent = (magnitude / MAX_BAR_PERCENT) * 100
          const isAbove = comparison.percentDifference >= 0
          return (
            <tr key={comparison.feature}>
              <td>{comparison.feature}</td>
              <td className="mono">{comparison.patientValue.toFixed(1)}</td>
              <td className="mono">{comparison.cohortAverage.toFixed(1)}</td>
              <td>
                <div className="delta-bar-wrap">
                  <div className={`delta-bar ${isAbove ? 'above' : 'below'}`} style={{ width: `${widthPercent}%` }} />
                  <span className="delta-bar-label mono">
                    {isAbove ? '+' : ''}
                    {comparison.percentDifference.toFixed(0)}%
                  </span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default CohortFeatureDeltaTable
