import { useRef, useState } from 'react'
import { CHART_COLORS, CONDITION_LABELS, correlationColor } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'

const CELL_SIZE = 82
// Row labels need width; the column header only needs one line of type.
const LABEL_W = 108
const LABEL_H = 26

function labelFor(condition) {
  return CONDITION_LABELS[condition] || condition
}

/** Custom SVG heatmap: conditions on both axes, cell color = diverging Spearman-r scale. */
function ConditionCorrelationHeatmap({ conditions, matrix }) {
  const containerRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  if (!conditions || conditions.length === 0 || !matrix || matrix.length === 0) {
    return <ChartEmptyState message="No correlation data available" height={200} />
  }

  const n = conditions.length
  const width = LABEL_W + n * CELL_SIZE
  const height = LABEL_H + n * CELL_SIZE

  const handleMove = (event, rowIndex, colIndex, value) => {
    const bounds = containerRef.current.getBoundingClientRect()
    setHovered({ rowIndex, colIndex, value, x: event.clientX - bounds.left, y: event.clientY - bounds.top })
  }

  return (
    <div className="heatmap-wrap" ref={containerRef} onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Condition risk correlation matrix">
        {conditions.map((condition, colIndex) => (
          <text
            key={`col-${condition}`}
            x={LABEL_W + colIndex * CELL_SIZE + CELL_SIZE / 2}
            y={LABEL_H - 10}
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill={CHART_COLORS.textMuted}
          >
            {labelFor(condition)}
          </text>
        ))}
        {conditions.map((rowCondition, rowIndex) => (
          <g key={`row-${rowCondition}`}>
            <text
              x={LABEL_W - 10}
              y={LABEL_H + rowIndex * CELL_SIZE + CELL_SIZE / 2 + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="500"
              fill={CHART_COLORS.textMuted}
            >
              {labelFor(rowCondition)}
            </text>
            {conditions.map((colCondition, colIndex) => {
              const value = matrix[rowIndex]?.[colIndex] ?? 0
              const textColor = Math.abs(value) > 0.5 ? CHART_COLORS.onStrong : CHART_COLORS.text
              return (
                <g
                  key={`cell-${rowCondition}-${colCondition}`}
                  className="heatmap-cell"
                  onMouseMove={(event) => handleMove(event, rowIndex, colIndex, value)}
                  style={{ cursor: 'pointer', '--i': rowIndex + colIndex }}
                >
                  <rect
                    x={LABEL_W + colIndex * CELL_SIZE}
                    y={LABEL_H + rowIndex * CELL_SIZE}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    fill={correlationColor(value)}
                    stroke={CHART_COLORS.surface}
                  />
                  <text
                    x={LABEL_W + colIndex * CELL_SIZE + CELL_SIZE / 2}
                    y={LABEL_H + rowIndex * CELL_SIZE + CELL_SIZE / 2 + 5}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="500"
                    fill={textColor}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {value.toFixed(2)}
                  </text>
                </g>
              )
            })}
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="chart-tooltip heatmap-tooltip" style={{ left: hovered.x + 12, top: hovered.y + 12 }}>
          <div className="chart-tooltip-label">
            {labelFor(conditions[hovered.rowIndex])} × {labelFor(conditions[hovered.colIndex])}
          </div>
          <div className="chart-tooltip-row">Spearman r = {hovered.value.toFixed(3)}</div>
        </div>
      )}
    </div>
  )
}

export default ConditionCorrelationHeatmap
