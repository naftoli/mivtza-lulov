import { useCallback, useEffect, useState } from 'react'
import { subscribe } from '../services/api.js'

// Runs an async loader and re-runs it whenever the data changes (a new shake,
// an admin edit, another browser tab, the 30s live poll) — the "live" feel.
//
// Callers MUST render `error`. The comment below used to say a rejected loader
// "must not leave the page spinning forever", and this hook holds up its end by
// clearing `loading` — but `data` stays null, so a caller that only checks
// `loading || !data` spins anyway. That is what every screen did during the API
// outage: a permanent spinner and no way to tell something had broken.
export function useLiveData(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  // Lets an error state offer "Try again" without a full page reload.
  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let alive = true
    // One request at a time. A slow read (the admin's pending photos) used to
    // get a second copy stacked on it by every 30s poll, and whichever came
    // back last won — so a response started before an approve could land after
    // the one started after it and put the approved card back. A change that
    // arrives mid-request now just asks for one more run once it finishes.
    let inFlight = false
    let again = false
    const refresh = () => {
      if (inFlight) {
        again = true
        return
      }
      inFlight = true
      run().then(
        (d) => {
          if (alive) {
            setData(d)
            setError(null)
            setLoading(false)
          }
        },
        (e) => {
          if (alive) {
            setError(e)
            setLoading(false)
          }
        },
      ).finally(() => {
        inFlight = false
        if (again && alive) {
          again = false
          refresh()
        }
      })
    }
    refresh()
    const unsub = subscribe(refresh)
    return () => {
      alive = false
      unsub()
    }
  }, [run, attempt])

  return { data, loading, error, reload }
}
