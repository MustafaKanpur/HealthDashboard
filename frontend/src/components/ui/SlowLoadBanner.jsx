import { useEffect, useState } from 'react'
import { getLoadStatus } from '../../api/client.js'

/** App-wide notice for a request that's taking far longer than usual
 * (usually the free-tier backend waking up), and for one that timed out.
 * Fast loads never show it; the page's own skeletons cover those. */
function SlowLoadBanner() {
  const [slow, setSlow] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    // ponytail: polls once a second rather than subscribing to client.js;
    // a one-second delay before the banner appears doesn't matter here.
    const id = setInterval(() => {
      const status = getLoadStatus()
      setSlow(status.slow)
      setTimedOut(status.timedOut)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // The live region stays mounted so screen readers announce what appears in it.
  return (
    <div className="slow-load" role="status" aria-live="polite">
      {timedOut ? (
        <div className="slow-load-failed">
          <span>The server timed out. Please try again.</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : (
        slow && (
          <>
            <div className="slow-load-track" role="progressbar" aria-label="Loading patient data">
              <div className="slow-load-fill" />
            </div>
            <p className="slow-load-text">Loading patient data</p>
          </>
        )
      )}
    </div>
  )
}

export default SlowLoadBanner
