import { useRef, useState } from 'react'
import { CHART_COLORS, CONDITION_LABELS, correlationColor } from './chartTheme.js'
import ChartEmptyState from './ChartEmptyState.jsx'

const CELL_SIZE = 84
const LABEL_SIZE = 100

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
  const size = LABEL_SIZE + n * CELL_SIZE

  const handleMove = (event, rowIndex, colIndex, value) => {
    const bounds = containerRef.current.getBoundingClientRect()
    setHovered({ rowIndex, colIndex, value, x: event.clientX - bounds.left, y: event.clientY - bounds.top })
  }

  return (
    <div className="heatmap-wrap" ref={containerRef} onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label="Condition risk correlation matrix">
        {conditions.map((condition, colIndex) => (
          <text
            key={`col-${condition}`}
            x={LABEL_SIZE + colIndex * CELL_SIZE + CELL_SIZE / 2}
            y={LABEL_SIZE - 14}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill={CHART_COLORS.textMuted}
          >
            {labelFor(condition)}
          </text>
        ))}
        {conditions.map((rowCondition, rowIndex) => (
          <g key={`row-${rowCondition}`}>
            <text
              x={LABEL_SIZE - 10}
              y={LABEL_SIZE + rowIndex * CELL_SIZE + CELL_SIZE / 2 + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="600"
              fill={CHART_COLORS.textMuted}
            >
              {labelFor(rowCondition)}
            </text>
            {conditions.map((colCondition, colIndex) => {
              const value = matrix[rowIndex]?.[colIndex] ?? 0
              const textColor = Math.abs(value) > 0.5 ? '#ffffff' : CHART_COLORS.text
              return (
                <g
                  key={`cell-${rowCondition}-${colCondition}`}
                  onMouseMove={(event) => handleMove(event, rowIndex, colIndex, value)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={LABEL_SIZE + colIndex * CELL_SIZE}
                    y={LABEL_SIZE + rowIndex * CELL_SIZE}
                    width={CELL_SIZE - 2}
                    height={CELL_SIZE - 2}
                    rx={4}
                    fill={correlationColor(value)}
                  />
                  <text
                    x={LABEL_SIZE + colIndex * CELL_SIZE + CELL_SIZE / 2}
                    y={LABEL_SIZE + rowIndex * CELL_SIZE + CELL_SIZE / 2 + 5}
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
