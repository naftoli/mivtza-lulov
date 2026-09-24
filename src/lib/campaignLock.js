// Soldier write-lock — "read-only for soldiers."
//
// Shake-logging is closed for BOTH sets of Yom Tov days of Sukkos 5787, and it
// reopens at EACH community's own tzeis, so a soldier is never unlocked while it
// is still Yom Tov (or Shabbos) where they are:
//   • First days  — locked from now → Motzei the 2nd day (Sun 27 Sep).
//   • Chol Hamoed — OPEN (Mon 28 Sep … Fri 2 Oct daytime).
//   • Last days   — locked from candle-lighting Erev Shmini Atzeres (Fri 2 Oct)
//                   → Motzei Simchas Torah (Sun 4 Oct). Shmini Atzeres (Sat 3 Oct)
//                   is also Shabbos this year, so this window covers it too.
// During a lock they can still log in and view their report, but not log or edit
// shakes. Admins are unaffected. Per-location times come from src/lib/tzeis.js.
import { tzeisUTC, sunsetUTC } from './tzeis.js'

// Civil dates (noon-UTC anchors) of each Yom Tov boundary. The real moments are
// that date's tzeis / sunset at the soldier's own location.
const FIRST_END = Date.UTC(2026, 8, 27, 12) // Motzei 2nd day (16 Tishrei) — reopen
const LAST_EREV = Date.UTC(2026, 9, 2, 12)  // Erev Shmini Atzeres (21 Tishrei) — lock at candle-lighting
const LAST_END = Date.UTC(2026, 9, 4, 12)   // Motzei Simchas Torah (23 Tishrei) — reopen
const CANDLE_MS = 18 * 60 * 1000            // candles are lit 18 min before sunset

// Fallbacks for a school we can't place (no coords, unknown city): stay locked
// across each whole window worldwide — before the earliest onset, past the latest
// tzeis among inhabited Jewish communities. Conservative on purpose: a late
// reopen costs nothing; an early one would let someone log on Yom Tov.
const FB_FIRST_END = Date.UTC(2026, 8, 28, 6, 0) // Mon 28 Sep 06:00 UTC (after last 1st-days motzei worldwide)
const FB_LAST_START = Date.UTC(2026, 9, 2, 3, 0) // Fri 2 Oct 03:00 UTC (before earliest onset worldwide)
const FB_LAST_END = Date.UTC(2026, 9, 5, 6, 0)   // Mon 5 Oct 06:00 UTC (after last 2nd-days motzei worldwide)

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

// The three per-school boundary instants (UTC ms): when the first days end, when
// the last days begin (candle-lighting), and when the last days end. Falls back
// to the conservative worldwide instants when the school can't be placed.
function bounds(school) {
  const c = schoolCoords(school)
  if (!c) return { firstEnd: FB_FIRST_END, lastStart: FB_LAST_START, lastEnd: FB_LAST_END }
  const firstEnd = tzeisUTC(FIRST_END, c.lat, c.lng) ?? FB_FIRST_END
  const sunset = sunsetUTC(LAST_EREV, c.lat, c.lng)
  const lastStart = sunset != null ? sunset - CANDLE_MS : FB_LAST_START
  const lastEnd = tzeisUTC(LAST_END, c.lat, c.lng) ?? FB_LAST_END
  return { firstEnd, lastStart, lastEnd }
}

// True while this school's soldiers are locked out of logging: before the first
// days end, or during the last days (candle-lighting → Motzei Simchas Torah).
// Chol Hamoed in between is open, as is Isru Chag onward.
export function soldierLocked(school, now = Date.now()) {
  const b = bounds(school)
  return now < b.firstEnd || (now >= b.lastStart && now < b.lastEnd)
}

// The UTC instant logging reopens next, given "now": Motzei the first days while
// still in that window, otherwise Motzei Simchas Torah. (Only meaningful when
// locked; harmless otherwise.)
export function reopenAt(school, now = Date.now()) {
  const b = bounds(school)
  return now < b.firstEnd ? b.firstEnd : b.lastEnd
}

// Friendly reopen time for the notice, e.g. "Sunday, Sep 27, 7:27 PM" — shown in
// the visitor's local clock, which at their own community is their Motzei Yom Tov.
export function lockReopenText(school, now = Date.now()) {
  return new Date(reopenAt(school, now)).toLocaleString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
