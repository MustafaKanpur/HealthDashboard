import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS, SHAP_DOWN_COLOR, SHAP_UP_COLOR } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/** Horizontal bar chart of SHAP feature contributions, sorted by |value| descending. */
function ShapFeatureBarChart({ shapValues }) {
  if (!shapValues || shapValues.length === 0) {
    return <ChartEmptyState message="No SHAP feature contributions available" />
  }

  const sorted = [...shapValues].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const height = Math.max(160, sorted.length * 32)

  return (
    <div className="shap-chart">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke={CHART_COLORS.border} horizontal={false} />
          <XAxis type="number" tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} />
          <YAxis type="category" dataKey="feature" width={140} tick={{ fill: CHART_COLORS.text, fontSize: 12 }} />
          <ReferenceLine x={0} stroke={CHART_COLORS.textFaint} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.surfaceTint }} />
          <Bar dataKey="value" name="SHAP value" radius={3}>
            {sorted.map((entry) => (
              <Cell key={entry.feature} fill={entry.value >= 0 ? SHAP_UP_COLOR : SHAP_DOWN_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="chart-legend-row">
        <span className="chart-legend-dot" style={{ background: SHAP_UP_COLOR }} /> Increases risk
        <span className="chart-legend-dot" style={{ background: SHAP_DOWN_COLOR }} /> Decreases risk
      </div>
    </div>
  )
}

export default ShapFeatureBarChart
