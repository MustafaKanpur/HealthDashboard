/** Shared Recharts tooltip renderer, reused across every chart in this
 * directory that plots more than a bare sparkline, so tooltip styling stays
 * consistent instead of being redefined per chart. */
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== null && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((entry, index) => (
        <div className="chart-tooltip-row" key={`${entry.name}-${index}`}>
          <span className="chart-tooltip-swatch" style={{ background: entry.color || entry.fill }} />
          <span>
            {entry.name}: {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default ChartTooltip
