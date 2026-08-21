import { CHART_COLORS } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'

const BIN_COUNT = 10
const CHART_WIDTH = 280
const CHART_HEIGHT = 120
const AXIS_Y = CHART_HEIGHT - 20
const BIN_WIDTH = CHART_WIDTH / BIN_COUNT

function buildBins(distribution) {
  const bins = Array.from({ length: BIN_COUNT }, () => 0)
  for (const score of distribution) {
    bins[Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(score * BIN_COUNT)))] += 1
  }
  return bins
}

// Hand-rolled SVG rather than a Recharts BarChart: the patient's score needs
// a precise continuous-position vertical marker, which doesn't sit well on a
// categorical/binned bar axis.
function DistributionChart({ distribution, patientScore }) {
  const bins = buildBins(distribution)
  const maxCount = Math.max(...bins, 1)
  const patientX = Math.min(1, Math.max(0, patientScore)) * CHART_WIDTH

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" role="img" aria-label="Cohort risk score distribution">
      {bins.map((count, index) => {
        const barHeight = (count / maxCount) * (AXIS_Y - 8)
        return (
          <rect
            key={index}
            x={index * BIN_WIDTH + 1}
            y={AXIS_Y - barHeight}
            width={BIN_WIDTH - 2}
            height={barHeight}
            rx={2}
            fill={CHART_COLORS.accentSoft}
            stroke={CHART_COLORS.accent}
            strokeOpacity={0.35}
          />
        )
      })}
      <line x1={0} y1={AXIS_Y} x2={CHART_WIDTH} y2={AXIS_Y} stroke={CHART_COLORS.border} />
      <line x1={patientX} y1={4} x2={patientX} y2={AXIS_Y} stroke={CHART_COLORS.accent} strokeWidth={2} />
      <polygon points={`${patientX - 5},0 ${patientX + 5},0 ${patientX},7`} fill={CHART_COLORS.accent} />
      <text x={patientX} y={AXIS_Y + 15} textAnchor="middle" fontSize="10" fontWeight="600" fill={CHART_COLORS.accent}>
        this patient
      </text>
    </svg>
  )
}

/** Headline percentile stat + distribution chart for how this patient's risk
 * compares to their KMeans-clustered cohort (similar patients), not the
 * whole panel. */
function CohortComparisonCard({
  sufficientData,
  cohortSize,
  patientRiskScore,
  cohortAverageRiskScore,
  cohortPercentile,
  cohortRiskDistribution,
}) {
  if (!sufficientData) {
    return (
      <ChartEmptyState
        message={`Not enough similar patients yet (cohort of ${cohortSize}) for a meaningful comparison.`}
        height={140}
      />
    )
  }

  return (
    <div className="cohort-comparison-card">
      <p className="cohort-headline">
        This patient's risk is higher than <strong className="mono">{Math.round(cohortPercentile)}%</strong> of
        similar patients.
      </p>
      <div className="cohort-stats-row">
        <div>
          <div className="cohort-stat-label">Patient risk</div>
          <div className="cohort-stat-value mono">{Math.round(patientRiskScore * 100)}%</div>
        </div>
        <div>
          <div className="cohort-stat-label">Cohort average</div>
          <div className="cohort-stat-value mono">{Math.round(cohortAverageRiskScore * 100)}%</div>
        </div>
        <div>
          <div className="cohort-stat-label">Cohort size</div>
          <div className="cohort-stat-value mono">{cohortSize}</div>
        </div>
      </div>
      <DistributionChart distribution={cohortRiskDistribution} patientScore={patientRiskScore} />
    </div>
  )
}

export default CohortComparisonCard
