import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const SetPageTitleContext = createContext(() => {})

const ROUTE_TITLES = [
  { match: (path) => path === '/', title: 'Patient panel' },
  { match: (path) => path.startsWith('/patients/'), title: 'Patient chart' },
  { match: (path) => path === '/compare', title: 'Compare patients' },
  // Not 'Population analytics': that's the page's own meta line, and the
  // bar sitting right above it would read as a stutter.
  { match: (path) => path.startsWith('/analytics'), title: 'Analytics' },
]

function titleForPath(path) {
  return ROUTE_TITLES.find((route) => route.match(path))?.title || 'Vitalis'
}

/** Name for the sticky bar: the route's own label, unless the page has
 * something more specific to say (a patient's name, say).
 *
 * The stored title is tagged with the path it came from and ignored once
 * the path changes, rather than cleared by an effect — child effects run
 * before the parent's, so a reset effect here would wipe the title the
 * incoming page just set. */
export function usePageTitleState(pathname) {
  const [stored, setStored] = useState({ path: pathname, title: null })

  const setPageTitle = useCallback(
    (title) => {
      setStored({ path: pathname, title })
    },
    [pathname]
  )

  const title = (stored.path === pathname && stored.title) || titleForPath(pathname)
  return [title, setPageTitle]
}

export function PageTitleProvider({ setPageTitle, children }) {
  return <SetPageTitleContext.Provider value={setPageTitle}>{children}</SetPageTitleContext.Provider>
}

/** Call from a page to name it in the sticky bar. Falsy titles are ignored,
 * so a page can pass data that hasn't loaded yet and keep the route label
 * until it arrives. */
export function usePageTitle(title) {
  const setPageTitle = useContext(SetPageTitleContext)
  useEffect(() => {
    if (title) setPageTitle(title)
  }, [title, setPageTitle])
}
