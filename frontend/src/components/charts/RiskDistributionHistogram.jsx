import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS, riskTierColor } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'
import ChartTooltip from './ChartTooltip.jsx'

const BIN_SIZE = 10

function buildBins(patients) {
  const bins = Array.from({ length: 100 / BIN_SIZE }, (_, i) => ({
    label: `${i * BIN_SIZE}-${i * BIN_SIZE + BIN_SIZE}`,
    midpoint: i * BIN_SIZE + BIN_SIZE / 2,
    count: 0,
  }))
  for (const patient of patients) {
    const score = Math.max(0, Math.min(99.999, patient.riskScore))
    bins[Math.floor(score / BIN_SIZE)].count += 1
  }
  return bins
}

/** Histogram of risk scores across the full patient panel, binned and colored by risk tier. */
function RiskDistributionHistogram({ patients }) {
  if (!patients || patients.length === 0) {
    return <ChartEmptyState message="No patient risk scores available" />
  }

  const bins = buildBins(patients)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={bins} margin={{ left: 4, right: 16 }}>
        <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_COLORS.textMuted, fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fill: CHART_COLORS.textMuted, fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.surfaceTint }} />
        <Bar dataKey="count" name="Patients" radius={[3, 3, 0, 0]}>
          {bins.map((bin) => (
            <Cell key={bin.label} fill={riskTierColor(bin.midpoint)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default RiskDistributionHistogram
