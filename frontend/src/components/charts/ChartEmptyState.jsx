/** Shared placeholder shown by every chart component when its data prop is missing/empty. */
function ChartEmptyState({ message = 'No data available', height = 160 }) {
  return (
    <div className="chart-empty-state" style={{ height }}>
      {message}
    </div>
  )
}

export default ChartEmptyState
