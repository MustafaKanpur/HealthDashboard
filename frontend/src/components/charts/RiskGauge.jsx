import { CHART_COLORS, riskTierColor, riskTierLabel } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import { useCountUp } from '../ui/CountUp.jsx'

// Custom SVG semicircle gauge (no chart library needed for this shape).
// Angle convention: 180deg = left (score 0) sweeping clockwise through
// 270deg (top, score 50) to 360deg (right, score 100).
const CX = 100
const CY = 100
const R = 80
const TRACK_WIDTH = 14
const NEEDLE_LENGTH = R - TRACK_WIDTH / 2 - 8

const BAND_RANGES = [
  { from: 0, to: 33, tier: 'good' },
  { from: 33, to: 66, tier: 'warning' },
  { from: 66, to: 100, tier: 'critical' },
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
  // The gauge spans at most 180deg, so the large-arc flag is always 0.
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
}

/** Semicircle risk gauge: 0-100 score, color-banded track, needle + filled
 * arc. On mount the arc draws in, the needle sweeps up from zero, and the
 * number counts up — all settling on the same value together. */
function RiskGauge({ score }) {
  const valid = !(score === null || score === undefined || Number.isNaN(score))
  const clamped = valid ? Math.max(0, Math.min(100, score)) : 0
  const display = useCountUp(clamped, 1100)

  if (!valid) {
    return <ChartEmptyState message="No risk score available" height={120} />
  }

  const color = riskTierColor(clamped)
  const tier = riskTierLabel(clamped)

  return (
    <div className={`risk-gauge ${tier}`}>
      <svg viewBox="0 0 200 140" width="100%" role="img" aria-label={`Risk score ${Math.round(clamped)} of 100, ${tier}`}>
        {BAND_RANGES.map((band) => (
          <path
            key={band.from}
            d={describeArc(R, band.from, band.to)}
            stroke={CHART_COLORS[band.tier]}
            strokeWidth={TRACK_WIDTH}
            fill="none"
            opacity={CHART_COLORS.trackOpacity}
          />
        ))}
        {[33, 66].map((tick) => {
          const inner = pointOnArc(R - TRACK_WIDTH / 2 - 3, tick)
          const outer = pointOnArc(R + TRACK_WIDTH / 2 + 3, tick)
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={CHART_COLORS.surface}
              strokeWidth={2}
            />
          )
        })}
        {clamped > 0 && (
          <path
            d={describeArc(R, 0, clamped)}
            stroke={color}
            strokeWidth={TRACK_WIDTH}
            strokeLinecap="round"
            fill="none"
            pathLength="100"
            className="gauge-arc"
          />
        )}
        <g className="gauge-needle" style={{ '--needle-angle': `${clamped * 1.8}deg` }}>
          <line x1={CX} y1={CY} x2={CX - NEEDLE_LENGTH} y2={CY} stroke={CHART_COLORS.text} strokeWidth={3} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={7} fill={CHART_COLORS.text} />
        <circle cx={CX} cy={CY} r={2.5} fill={CHART_COLORS.surface} />
        <text
          x={CX}
          y={136}
          textAnchor="middle"
          fontSize="26"
          fontWeight="600"
          fill={color}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {Math.round(display)}
        </text>
      </svg>
    </div>
  )
}

export default RiskGauge
