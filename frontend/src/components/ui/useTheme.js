import { useCallback, useEffect, useState } from 'react'
import { setChartTheme } from '../charts/chartTheme.js'

const STORAGE_KEY = 'vitalis-theme'

/** Saved choice wins; otherwise follow the OS. Mirrors the inline script in
 * index.html, which applies the same answer before first paint so the page
 * never flashes light before switching. */
export function preferredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Private mode / blocked storage: fall through to the OS preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Single source of truth for the theme: sets data-theme for CSS, points the
 * chart palette at the matching colors, and remembers the choice. */
export function useTheme() {
  const [theme, setTheme] = useState(preferredTheme)

  // Synchronous, not in an effect: charts read CHART_COLORS while rendering
  // this same pass, so the palette has to be switched before they do.
  setChartTheme(theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Not being able to remember the choice shouldn't break switching it.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return [theme, toggleTheme]
}
