import { useMemo } from 'react'

// Seamlessly looping waveforms: each path spans two identical halves and the
// group translates by exactly one half, so the loop point is invisible.
const WIDTH = 2880
const HALF = WIDTH / 2

function sinePath(amplitude, period, baseline, phase = 0) {
  let d = `M 0 ${baseline + amplitude * Math.sin(phase)}`
  for (let x = 12; x <= WIDTH; x += 12) {
    d += ` L ${x} ${(baseline + amplitude * Math.sin((x / period) * Math.PI * 2 + phase)).toFixed(2)}`
  }
  return d
}

// One heartbeat: flat, P wave, QRS complex, T wave — repeated across the width.
function ecgPath(period, baseline, scale) {
  const beat = [
    [0, 0], [0.18, 0], [0.22, -0.08], [0.26, 0], [0.34, 0],
    [0.36, 0.12], [0.39, -1], [0.42, 0.35], [0.45, 0], [0.56, 0],
    [0.62, -0.18], [0.68, 0], [1, 0],
  ]
  let d = `M 0 ${baseline}`
  for (let start = 0; start < WIDTH; start += period) {
    for (const [fx, fy] of beat) {
      d += ` L ${(start + fx * period).toFixed(1)} ${(baseline + fy * scale).toFixed(1)}`
    }
  }
  return d
}

/** Fixed, pointer-transparent ambient layer: slow-drifting aurora light, a
 * faint clinical grid, and vital-sign waveforms flowing across the bottom.
 * Kept at very low contrast so it reads as atmosphere, never as content. */
function AmbientBackground() {
  const waves = useMemo(
    () => ({
      ecg: ecgPath(360, 120, 46),
      sineA: sinePath(14, 480, 150, 0),
      sineB: sinePath(10, 720, 165, 1.4),
    }),
    []
  )

  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-blob ambient-blob--a" />
      <div className="ambient-blob ambient-blob--b" />
      <div className="ambient-blob ambient-blob--c" />

      <svg className="ambient-grid" width="100%" height="100%">
        <defs>
          <pattern id="ambient-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="#1a56db" />
          </pattern>
          <radialGradient id="ambient-fade" cx="60%" cy="20%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="ambient-mask">
            <rect width="100%" height="100%" fill="url(#ambient-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-dots)" mask="url(#ambient-mask)" />
      </svg>

      <svg className="ambient-waves" viewBox={`0 0 ${HALF} 220`} preserveAspectRatio="none">
        <g className="ambient-wave-track ambient-wave-track--slow">
          <path d={waves.sineB} className="ambient-wave ambient-wave--faint" />
        </g>
        <g className="ambient-wave-track ambient-wave-track--mid">
          <path d={waves.sineA} className="ambient-wave ambient-wave--faint" />
        </g>
        <g className="ambient-wave-track ambient-wave-track--ecg">
          <path d={waves.ecg} className="ambient-wave ambient-wave--ecg" />
        </g>
      </svg>
    </div>
  )
}

export default AmbientBackground
