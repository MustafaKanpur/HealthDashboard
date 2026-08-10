import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from './chartTheme.js'

/** Tiny inline sparkline for a patient-list row: no axes, single line, ~80x24px. */
function PatientTableSparklines({ values }) {
  if (!values || values.length < 2) {
    return <span className="sparkline-empty">—</span>
  }

  const data = values.map((value, index) => ({ index, value }))
  const trendingUp = values[values.length - 1] >= values[0]

  return (
    <ResponsiveContainer width={80} height={24}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={trendingUp ? CHART_COLORS.critical : CHART_COLORS.good}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default PatientTableSparklines
