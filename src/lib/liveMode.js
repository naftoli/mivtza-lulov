const LIVE_KEY = 'ml_real'

function currentSearch() {
  try {
    return new URLSearchParams(window.location.search)
  } catch {
    return new URLSearchParams()
  }
}

export function readLiveMode() {
  if (typeof window === 'undefined') return false
  const params = currentSearch()
  if (params.get('real') === '1') {
    try { sessionStorage.setItem(LIVE_KEY, '1') } catch { /* blocked storage */ }
    return true
  }
  if (params.get('real') === '0') {
    try { sessionStorage.removeItem(LIVE_KEY) } catch { /* blocked storage */ }
    return false
  }
  try {
    return sessionStorage.getItem(LIVE_KEY) === '1'
  } catch {
    return false
  }
}

export const IS_LIVE = readLiveMode()
export const IS_DEMO = !IS_LIVE
