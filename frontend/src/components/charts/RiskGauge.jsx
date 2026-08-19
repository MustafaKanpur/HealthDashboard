import { CHART_COLORS, riskTierColor, riskTierLabel } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'

// Custom SVG semicircle gauge (no chart library needed for this shape).
// Angle convention: 180deg = left (score 0) sweeping clockwise through
// 270deg (top, score 50) to 360deg (right, score 100).
const CX = 100
const CY = 100
const R = 80
const TRACK_WIDTH = 16

const BANDS = [
  { from: 0, to: 33, color: CHART_COLORS.good },
  { from: 33, to: 66, color: CHART_COLORS.warning },
  { from: 66, to: 100, color: CHART_COLORS.critical },
]

function angleForScore(score) {
  return 180 + (Math.max(0, Math.min(100, score)) / 100) * 180
}

function pointOnArc(radius, score) {
  const rad = (angleForScore(score) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

function describeArc(radius, fromScore, toScore) {
  const start = pointOnArc(radius, fromScore)
  const end = pointOnArc(radius, toScore)
  const largeArcFlag = toScore - fromScore > 50 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

/** Semicircle risk gauge: 0-100 score, color-banded track, needle + filled arc. */
function RiskGauge({ score }) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return <ChartEmptyState message="No risk score available" height={120} />
  }
  const clamped = Math.max(0, Math.min(100, score))
  const needle = pointOnArc(R - TRACK_WIDTH / 2 - 6, clamped)
  const color = riskTierColor(clamped)

  const tier = riskTierLabel(clamped)

  return (
    <div className={`risk-gauge ${tier}`}>
      <svg viewBox="0 0 200 112" width="100%" role="img" aria-label={`Risk score ${Math.round(clamped)} of 100`}>
        {BANDS.map((band) => (
          <path
            key={band.from}
            d={describeArc(R, band.from, band.to)}
            stroke={band.color}
            strokeWidth={TRACK_WIDTH}
            fill="none"
            opacity={0.22}
          />
        ))}
        <path d={describeArc(R, 0, clamped)} stroke={color} strokeWidth={TRACK_WIDTH} strokeLinecap="round" fill="none" />
        <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke={CHART_COLORS.text} strokeWidth={3} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={6} fill={CHART_COLORS.text} />
        <text
          x={CX}
          y={78}
          textAnchor="middle"
          fontSize="26"
          fontWeight="600"
          fill={color}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {Math.round(clamped)}
        </text>
        <text x={CX} y={96} textAnchor="middle" fontSize="11" fontWeight="600" fill={CHART_COLORS.textMuted} className="risk-gauge-tier">
          {tier} risk
        </text>
      </svg>
    </div>
  )
}

export default RiskGauge
