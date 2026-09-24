// Soldier write-lock — "read-only for soldiers."
//
// Shake-logging is closed from now until the first days of Yom Tov (Sukkos 5787)
// end, and it reopens at EACH community's own Motzei Yom Tov (tzeis), so a soldier
// is never unlocked while it is still Yom Tov where they are. During the lock they
// can still log in and view their report, but not log or edit shakes. Admins are
// unaffected. The unlock instant per school is computed with src/lib/tzeis.js.
import { tzeisUTC } from './tzeis.js'

// The civil date the first days of Yom Tov end: Motzei the 2nd day = Sun 27 Sep
// 2026 (16 Tishrei). Noon UTC is just an anchor inside that date; the real
// reopen moment is that date's tzeis at the soldier's own location.
const YT_END_DAY = Date.UTC(2026, 8, 27, 12)

// When a school can't be placed (no coords, unknown city), stay locked until Yom
// Tov is over EVERYWHERE — past the latest Motzei YT among inhabited Jewish
// communities (~Honolulu tzeis, 04:57 UTC Mon). Conservative on purpose: a late
// reopen costs nothing; an early one would let someone log on Yom Tov.
const FALLBACK_UNLOCK = Date.UTC(2026, 8, 28, 6, 0) // Mon 28 Sep, 06:00 UTC

// Coordinates so each community unlocks at its own tzeis. Keyed by a normalized
// city (lowercase, text before the first comma). LIVE schools should carry
// `lat`/`lng` from the backend (see docs/mashpia-integration.md §B); this map
// covers the demo roster and common Chabad centers as a fallback. Add more as the
// live roster grows — an unlisted city just falls back to the worldwide unlock.
const CITY_COORDS = {
  'brooklyn': { lat: 40.669, lng: -73.943 },
  'crown heights': { lat: 40.669, lng: -73.943 },
  'baltimore': { lat: 39.29, lng: -76.61 },
  'los angeles': { lat: 34.05, lng: -118.24 },
  'chicago': { lat: 41.85, lng: -87.65 },
  'miami': { lat: 25.76, lng: -80.19 },
  'monsey': { lat: 41.11, lng: -74.07 },
  'lakewood': { lat: 40.09, lng: -74.22 },
  'postville': { lat: 43.08, lng: -91.57 },
  'detroit': { lat: 42.33, lng: -83.05 },
  'pittsburgh': { lat: 40.44, lng: -79.99 },
  'montreal': { lat: 45.50, lng: -73.57 },
  'toronto': { lat: 43.65, lng: -79.38 },
  'london': { lat: 51.51, lng: -0.13 },
  'manchester': { lat: 53.48, lng: -2.24 },
  'paris': { lat: 48.86, lng: 2.35 },
  'jerusalem': { lat: 31.78, lng: 35.22 },
  'tel aviv': { lat: 32.08, lng: 34.78 },
  'melbourne': { lat: -37.81, lng: 144.96 },
  'sydney': { lat: -33.87, lng: 151.21 },
  'san francisco': { lat: 37.77, lng: -122.42 },
  'seattle': { lat: 47.61, lng: -122.33 },
  'denver': { lat: 39.74, lng: -104.99 },
  'phoenix': { lat: 33.45, lng: -112.07 },
  'honolulu': { lat: 21.31, lng: -157.86 },
  'anchorage': { lat: 61.22, lng: -149.9 },
}

const norm = (city) => String(city || '').split(',')[0].trim().toLowerCase()

// Best coordinates we have for a school: explicit lat/lng (live) → city map → none.
function schoolCoords(school) {
  const lat = Number(school?.lat), lng = Number(school?.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return CITY_COORDS[norm(school?.city)] || null
}

// UTC instant logging reopens for a school — its own Motzei Yom Tov, or the
// conservative worldwide fallback when we can't place it.
export function unlockAt(school) {
  const c = schoolCoords(school)
  if (!c) return FALLBACK_UNLOCK
  return tzeisUTC(YT_END_DAY, c.lat, c.lng) ?? FALLBACK_UNLOCK
}

// True while this school's soldiers are locked out of logging.
export function soldierLocked(school, now = Date.now()) {
  return now < unlockAt(school)
}

// Friendly reopen time for the notice, e.g. "Sunday, Sep 27, 7:27 PM" — shown in
// the visitor's local clock, which at their own community is their Motzei Yom Tov.
export function lockReopenText(school) {
  return new Date(unlockAt(school)).toLocaleString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
