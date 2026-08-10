import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import ChartTooltip from './ChartTooltip.jsx'

function AnomalyDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null
  const isAnomaly = payload.isAnomaly
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isAnomaly ? 5.5 : 3}
      fill={isAnomaly ? CHART_COLORS.critical : CHART_COLORS.accent}
      stroke={isAnomaly ? CHART_COLORS.critical : 'none'}
      strokeOpacity={0.25}
      strokeWidth={isAnomaly ? 5 : 0}
    />
  )
}

/** Lab value over time with anomalous points rendered as distinct red markers. */
function AnomalyHighlightChart({ data }) {
  if (!data || data.length === 0) {
    return <ChartEmptyState message="No lab values available" />
  }

  const anomalyCount = data.filter((point) => point.isAnomaly).length

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ left: 4, right: 16, top: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} />
          <YAxis tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name="Value"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={<AnomalyDot />}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {anomalyCount > 0 && (
        <div className="chart-legend-row">
          <span className="chart-legend-dot" style={{ background: CHART_COLORS.critical }} />
          {anomalyCount} anomalous value{anomalyCount === 1 ? '' : 's'} flagged
        </div>
      )}
    </div>
  )
}

export default AnomalyHighlightChart
