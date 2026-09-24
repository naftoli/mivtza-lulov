// Tzeis hakochavim (nightfall) — when three stars come out, i.e. when the sun
// sits `angle` degrees below the horizon. Used to reopen soldier logging at each
// community's OWN Motzei Yom Tov, so nobody is unlocked while it is still Yom Tov
// where they are.
//
// The sun math is a compact port of SunCalc (github.com/mourner/suncalc, BSD).
// Validated against chabad.org zmanim for 27 Sep 2026: sunset matches Brooklyn
// and Los Angeles to the minute, and tzeis at 8.5° lands ~2 min after Chabad's
// "Holiday Ends" time (the safe side — never reopen early).
const PI = Math.PI, rad = PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009
const E = rad * 23.4397

const toDays = (ms) => ms / dayMs - 0.5 + J1970 - J2000
const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d)
const eclipticLongitude = (M) =>
  M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + PI
const declination = (l) => Math.asin(Math.sin(E) * Math.sin(l))
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * PI))
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * PI) + n
const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)

// 8.5° below the horizon — the common "three stars" tzeis. Errs ~2 min LATE vs
// Chabad's holiday-ends time, which is the safe direction for a reopen.
export const TZEIS_ANGLE = 8.5
// Geometric sunset (shkiah): the sun's upper limb on the horizon, with the
// standard 34' refraction + 16' semidiameter → 0.833° below the horizon.
export const SUNSET_ANGLE = 0.833

// UTC epoch-ms of the evening moment the sun reaches `angle` below the horizon on
// the civil day containing `dateMs`, at lat/lng. Returns null in the rare polar
// case where the sun never reaches that depression.
export function sunEventUTC(dateMs, lat, lng, angle) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(dateMs)
  const n = julianCycle(d, lw), ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L)
  const cosH = (Math.sin(rad * -angle) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cosH < -1 || cosH > 1) return null
  const w = Math.acos(cosH), a = approxTransit(w, lw, n)
  return Math.round((solarTransitJ(a, M, L) + 0.5 - J1970) * dayMs)
}

// Tzeis hakochavim (nightfall) — Yom Tov / Shabbos ends. UTC epoch-ms, or null.
export const tzeisUTC = (dateMs, lat, lng, angle = TZEIS_ANGLE) => sunEventUTC(dateMs, lat, lng, angle)
// Shkiah (sunset) — Yom Tov / Shabbos begins at candle-lighting a bit before it.
export const sunsetUTC = (dateMs, lat, lng) => sunEventUTC(dateMs, lat, lng, SUNSET_ANGLE)
