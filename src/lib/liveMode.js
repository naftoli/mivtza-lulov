// Live Mashpia data is the default. `?demo=1` switches the same screens to the
// localStorage demo store (see services/api.js), and the choice sticks for the
// tab so navigation inside the SPA does not fall back to live data.
const DEMO_KEY = 'ml_demo'

function currentSearch() {
  try {
    return new URLSearchParams(window.location.search)
  } catch {
    return new URLSearchParams()
  }
}

function readDemoMode() {
  if (typeof window === 'undefined') return false
  const params = currentSearch()
  // `?real=1` / `?real=0` are how this used to be asked, back when demo data
  // was the default. Links and bookmarks still carry them, so they keep
  // working: real=0 means the demo, real=1 means live.
  const demo = params.get('demo')
  const real = params.get('real')
  if (demo === '1' || real === '0') {
    try { sessionStorage.setItem(DEMO_KEY, '1') } catch { /* blocked storage */ }
    return true
  }
  // A handoff code is a live credential: the parent site's link means live
  // data even in a tab that asked for the demo earlier.
  if (demo === '0' || real === '1' || params.get('handoff')) {
    try { sessionStorage.removeItem(DEMO_KEY) } catch { /* blocked storage */ }
    return false
  }
  try {
    return sessionStorage.getItem(DEMO_KEY) === '1'
  } catch {
    return false
  }
}

export const IS_DEMO = readDemoMode()
export const IS_LIVE = !IS_DEMO
