import { useLayoutEffect, useRef, useState } from 'react'

/** Segmented tab control with a sliding indicator. Arrow keys move between
 * tabs (roving tabindex), per the WAI-ARIA tabs pattern. */
function Tabs({ tabs, value, onChange, idPrefix = 'tab' }) {
  const buttonRefs = useRef({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      const active = buttonRefs.current[value]
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value, tabs])

  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === value)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onChange(next.id)
    buttonRefs.current[next.id]?.focus()
  }

  return (
    <div className="tabs" role="tablist" onKeyDown={handleKeyDown}>
      <span
        className="tabs-indicator"
        style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        aria-hidden="true"
      />
      {tabs.map((tab) => {
        const selected = tab.id === value
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttonRefs.current[tab.id] = node
            }}
            id={`${idPrefix}-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'selected' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
            {tab.badge !== undefined && tab.badge !== null && <span className="tab-badge mono">{tab.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
