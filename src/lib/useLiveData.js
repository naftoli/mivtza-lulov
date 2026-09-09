import { useCallback, useEffect, useState } from 'react'
import { subscribe } from '../services/api.js'

// Runs an async loader and re-runs it whenever the mock data changes
// (a new shake, an admin edit, another browser tab, etc.) — the "live" feel.
export function useLiveData(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      run().then((d) => {
        if (alive) {
          setData(d)
          setLoading(false)
        }
      })
    }
    refresh()
    const unsub = subscribe(refresh)
    return () => {
      alive = false
      unsub()
    }
  }, [run])

  return { data, loading }
}
