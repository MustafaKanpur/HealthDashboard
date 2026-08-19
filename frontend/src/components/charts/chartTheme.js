// Shared color tokens for chart components. Values mirror the CSS custom
// properties defined in ../../index.css (blue/white clinical palette +
// reserved status colors) — keep these two files in sync if the palette
// changes. Charting libraries need literal values (not `var(--x)`) so charts
// render correctly even where the app stylesheet isn't in the cascade (e.g.
// exported/printed).

export const CHART_COLORS = {
  good: '#15803d',
  goodBg: '#e4f7e7',
  warning: '#92400e',
  warningBg: '#fdf0da',
  critical: '#b91c1c',
  criticalBg: '#fbe4e4',
  accent: '#1a56db',
  accentSoft: '#eef3fc',
  text: '#0f2a5c',
  textMuted: '#4b5a72',
  textFaint: '#8695ac',
  border: '#dce6f5',
  surface: '#ffffff',
  surfaceTint: '#eef3fc',
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
  low: CHART_COLORS.good,
  medium: CHART_COLORS.warning,
  high: CHART_COLORS.critical,
}

export const SHAP_UP_COLOR = CHART_COLORS.critical // pushes predicted risk up
export const SHAP_DOWN_COLOR = CHART_COLORS.accent // pushes predicted risk down
