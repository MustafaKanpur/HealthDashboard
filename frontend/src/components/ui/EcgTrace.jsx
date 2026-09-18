// A patient-monitor style trace: a faint baseline heartbeat with a bright
// segment sweeping along it, like the leading edge of a live readout.
const BEAT = 'M0 18 H24 L28 15 L32 18 H40 L43 21 L47 4 L51 27 L55 18 H64 L70 13 L76 18 H98'
const TRACE = `${BEAT} ${BEAT.replace('M0 18 ', '').replace(/[HL](\d+)/g, (m, n) => m[0] + (Number(n) + 98))}`

function EcgTrace({ className = '' }) {
  return (
    <svg className={`ecg-trace ${className}`} viewBox="0 0 196 32" aria-hidden="true">
      <path d={TRACE} className="ecg-trace-base" />
      <path d={TRACE} className="ecg-trace-sweep" pathLength="1000" />
    </svg>
  )
}

export default EcgTrace
