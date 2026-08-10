import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import ChartTooltip from './ChartTooltip.jsx'

/** Radar of risk score (0-100) per chronic condition. */
function RiskRadarChart({ conditions }) {
  if (!conditions || conditions.length === 0) {
    return <ChartEmptyState message="No condition risk data available" height={280} />
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={conditions} outerRadius="72%">
        <PolarGrid stroke={CHART_COLORS.border} />
        <PolarAngleAxis dataKey="name" tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: CHART_COLORS.textFaint, fontSize: 10 }} />
        <Radar
          name="Risk score"
          dataKey="riskScore"
          stroke={CHART_COLORS.accent}
          fill={CHART_COLORS.accent}
          fillOpacity={0.35}
        />
        <Tooltip content={<ChartTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export default RiskRadarChart
