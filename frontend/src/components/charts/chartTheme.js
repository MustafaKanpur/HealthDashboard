// Shared color tokens for chart components. Values mirror the CSS custom
// properties defined in ../../index.css (clinical palette + reserved risk
// colors) — keep the two files in sync if the palette changes. Charting
// libraries need literal values (not `var(--x)`) so charts render correctly
// even where the app stylesheet isn't in the cascade (e.g. exported/printed).
//
// Both themes are defined here. CHART_COLORS reads through to the active
// palette on every property access, so a chart that reads a color during
// render picks up the current theme without any component needing to know
// a theme exists. Anything that captured a color at module load would go
// stale on switch, which is why nothing here is a plain literal export.

const PALETTES = {
  light: {
    good: '#1a6b38',
    goodBg: '#eaf4ed',
    warning: '#8a4b09',
    warningBg: '#fbf1e2',
    critical: '#a81f1f',
    criticalBg: '#fbeceb',
    accent: '#1a56db',
    accentSoft: '#eaf0fc',
    // Solid fill for bars/areas: light enough to sit under dark type.
    accentFill: '#dbe5f8',
    text: '#0e1b2e',
    textMuted: '#4a586c',
    textFaint: '#78859a',
    border: '#dfe4ec',
    surface: '#ffffff',
    surfaceTint: '#f6f8fb',
    // Type drawn on top of a saturated fill (heatmap cells).
    onStrong: '#ffffff',
    // Unfilled gauge track: tier color at low alpha over the surface.
    trackOpacity: 0.14,
  },
  dark: {
    // Tier hues lightened until they carry on a dark sheet; the reading
    // (green/amber/red = low/moderate/high) is unchanged.
    good: '#4fbf7b',
    goodBg: '#12241a',
    warning: '#d79b4a',
    warningBg: '#271d0f',
    critical: '#ef7f79',
    criticalBg: '#291616',
    accent: '#6b9bff',
    accentSoft: '#1d2635',
    accentFill: '#2b3d5c',
    text: '#e6ebf2',
    textMuted: '#a3b0c2',
    textFaint: '#7e8b9e',
    border: '#2a3442',
    surface: '#161c26',
    surfaceTint: '#1b222d',
    onStrong: '#0b1017',
    trackOpacity: 0.3,
  },
}

let active = 'light'

/** Point the chart palette at a theme. Called during render by useTheme,
 * before any chart reads a color, so charts and CSS never disagree. */
export function setChartTheme(theme) {
  active = theme === 'dark' ? 'dark' : 'light'
}

export const CHART_COLORS = {}
for (const key of Object.keys(PALETTES.light)) {
  Object.defineProperty(CHART_COLORS, key, {
    get: () => PALETTES[active][key],
    enumerable: true,
  })
}

/** 0-100 risk score -> tier color, per the low <33 / moderate 33-66 / high >66 bands. */
export function riskTierColor(score) {
  if (score > 66) return CHART_COLORS.critical
  if (score >= 33) return CHART_COLORS.warning
  return CHART_COLORS.good
}

export function riskTierLabel(score) {
  if (score > 66) return 'high'
  if (score >= 33) return 'moderate'
  return 'low'
}

/** Color lookup for components that take an explicit 'low' | 'medium' | 'high' tier prop. */
export const TIER_COLOR = {
  get low() {
    return CHART_COLORS.good
  },
  get medium() {
    return CHART_COLORS.warning
  },
  get high() {
    return CHART_COLORS.critical
  },
}

/** SHAP direction colors: red pushes predicted risk up, accent pulls it down. */
export const SHAP_COLORS = {
  get up() {
    return CHART_COLORS.critical
  },
  get down() {
    return CHART_COLORS.accent
  },
}

/** Display names for the backend's raw target keys (diabetes/hypertension/heart_disease). */
export const CONDITION_LABELS = {
  diabetes: 'Diabetes',
  hypertension: 'Hypertension',
  heart_disease: 'Heart Disease',
}

// Endpoints of the diverging correlation scale, per theme. r=0 lands on the
// sheet color, so "no relationship" reads as empty paper in either theme.
const CORRELATION_SCALE = {
  light: { positive: [26, 86, 219], negative: [74, 88, 108], base: [255, 255, 255] },
  dark: { positive: [122, 166, 255], negative: [148, 163, 184], base: [22, 28, 38] },
}

/**
 * Diverging correlation color: positive -> accent blue, negative -> muted
 * slate (not red/green — those are reserved for risk tiers), intensity
 * scaled by |r|, blended toward the sheet color at r=0. No new hues beyond
 * the app's existing accent/slate tokens.
 */
export function correlationColor(r) {
  const clamped = Math.max(-1, Math.min(1, r))
  const intensity = Math.abs(clamped)
  const scale = CORRELATION_SCALE[active]
  const [red, green, blue] = clamped >= 0 ? scale.positive : scale.negative
  const mix = (channel, from) => Math.round(from + (channel - from) * intensity)
  return `rgb(${mix(red, scale.base[0])}, ${mix(green, scale.base[1])}, ${mix(blue, scale.base[2])})`
}
