import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { CHART_COLORS, TIER_COLOR } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import ChartTooltip from './ChartTooltip.jsx'

const TIERS = ['low', 'medium', 'high']

/** Scatter of two configurable numeric fields (e.g. age vs risk score), colored by risk tier. */
function RiskScatterPlot({ data, xLabel, yLabel }) {
  if (!data || data.length === 0) {
    return <ChartEmptyState message="No patient data available to plot" />
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ left: 8, right: 16, bottom: 8, top: 8 }}>
        <CartesianGrid stroke={CHART_COLORS.border} />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }}
          label={{ value: xLabel, position: 'insideBottom', offset: -6, fill: CHART_COLORS.textMuted, fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: CHART_COLORS.textMuted, fontSize: 11 }}
        />
        <ZAxis range={[55, 55]} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {TIERS.map((tier) => (
          <Scatter
            key={tier}
            name={`${tier} risk`}
            data={data.filter((point) => point.tier === tier)}
            fill={TIER_COLOR[tier]}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default RiskScatterPlot
