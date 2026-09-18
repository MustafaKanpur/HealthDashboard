import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number from its previous value to `value` (ease-out cubic). */
export function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0)
  const fromRef = useRef(prefersReducedMotion() ? value : 0)

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return undefined
    if (prefersReducedMotion()) {
      setDisplay(value)
      fromRef.current = value
      return undefined
    }
    const from = fromRef.current
    const start = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setDisplay(from + (value - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return display
}

function CountUp({ value, decimals = 0, suffix = '', duration, className }) {
  const display = useCountUp(value, duration)
  return (
    <span className={className}>
      {display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

export default CountUp
