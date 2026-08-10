import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/** Vitals/lab trend over time, optional secondary-axis risk overlay and stdDev confidence band. */
function VitalsTrendChart({ data, metricLabel }) {
  if (!data || data.length === 0) {
    return <ChartEmptyState message="No trend data available" />
  }

  const hasRisk = data.some((point) => point.riskScore !== undefined && point.riskScore !== null)
  const chartData = data.map((point) => ({
    ...point,
    band: point.stdDev != null ? [point.value - point.stdDev, point.value + point.stdDev] : undefined,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ left: 4, right: hasRisk ? 8 : 24, top: 8 }}>
        <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }}
          label={{ value: metricLabel, angle: -90, position: 'insideLeft', fill: CHART_COLORS.textMuted, fontSize: 11 }}
        />
        {hasRisk && (
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: CHART_COLORS.textFaint, fontSize: 11 }} />
        )}
        <Tooltip content={<ChartTooltip />} />
        {hasRisk && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Area yAxisId="left" dataKey="band" name="Range" stroke="none" fill={CHART_COLORS.accentSoft} isAnimationActive={false} legendType="none" />
        <Line yAxisId="left" type="monotone" dataKey="value" name={metricLabel} stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3 }} />
        {hasRisk && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="riskScore"
            name="Risk score"
            stroke={CHART_COLORS.critical}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default VitalsTrendChart
