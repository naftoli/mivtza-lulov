// Nightfall (tzeis) and the soldier write-lock around Yom Tov.
//
// campaignLock.js decides, for each community, when soldiers may log shakes:
// shut through the first days of Yom Tov, open on Chol Hamoed, shut again from
// candle-lighting before Shmini Atzeres until Motzei Simchas Torah. Getting it
// wrong either lets someone log on Yom Tov or locks them out of a whole day, so
// the sun math is checked against an independent implementation and the lock
// against clock times with a safe margin either side.
//
//   node --test tests/web
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sunsetUTC, tzeisUTC } from '../../src/lib/tzeis.js'
import { soldierLocked, reopenAt, lockReopenText } from '../../src/lib/campaignLock.js'

// Sunset, end of civil twilight (6 deg) and end of nautical twilight (12 deg),
// UTC ms, from PHP's date_sun_info() -- a separate implementation -- on the three
// Yom Tov boundary dates. For Melbourne PHP was given the next day's timestamp:
// for far-eastern longitudes it reports the previous day's sunset otherwise, so
// each entry was kept only once it fell on the right local date.
const REFERENCE = {
  "brooklyn": {
    "2026-09-27": [1790549092000, 1790550722000, 1790552629000],
    "2026-10-02": [1790980592000, 1790982224000, 1790984125000],
    "2026-10-04": [1791153195000, 1791154828000, 1791156728000],
  },
  "los angeles": {
    "2026-09-27": [1790559771000, 1790561263000, 1790563005000],
    "2026-10-02": [1790991357000, 1790992850000, 1790994589000],
    "2026-10-04": [1791163994000, 1791165489000, 1791167227000],
  },
  "london": {
    "2026-09-27": [1790531288000, 1790533276000, 1790535618000],
    "2026-10-02": [1790962603000, 1790964591000, 1790966917000],
    "2026-10-04": [1791135131000, 1791137120000, 1791139442000],
  },
  "jerusalem": {
    "2026-09-27": [1790522993000, 1790524447000, 1790526145000],
    "2026-10-02": [1790954605000, 1790956060000, 1790957755000],
    "2026-10-04": [1791127252000, 1791128709000, 1791130403000],
  },
  "melbourne": {
    "2026-09-27": [1790497231000, 1790498801000, 1790500648000],
    "2026-10-02": [1790929495000, 1790931072000, 1790932934000],
    "2026-10-04": [1791102403000, 1791103984000, 1791105853000],
  },
  "honolulu": {
    "2026-09-27": [1790569375000, 1790570702000, 1790572248000],
    "2026-10-02": [1791001095000, 1791002423000, 1791003969000],
    "2026-10-04": [1791173785000, 1791175115000, 1791176661000],
  },
  "anchorage": {
    "2026-09-27": [1790567013000, 1790569586000, 1790572657000],
    "2026-10-02": [1790998065000, 1791000636000, 1791003665000],
    "2026-10-04": [1791170487000, 1791173062000, 1791176079000],
  },
  "montreal": {
    "2026-09-27": [1790548955000, 1790550719000, 1790552788000],
    "2026-10-02": [1790980382000, 1790982147000, 1790984207000],
    "2026-10-04": [1791152955000, 1791154721000, 1791156779000],
  },
}

const COORDS = {
  brooklyn: [40.669, -73.943], 'los angeles': [34.05, -118.24], london: [51.51, -0.13],
  jerusalem: [31.78, 35.22], melbourne: [-37.81, 144.96], honolulu: [21.31, -157.86],
  anchorage: [61.22, -149.9], montreal: [45.50, -73.57],
}
// The noon-UTC anchors campaignLock.js passes for each boundary date.
const ANCHOR = {
  '2026-09-27': Date.UTC(2026, 8, 27, 12),
  '2026-10-02': Date.UTC(2026, 9, 2, 12),
  '2026-10-04': Date.UTC(2026, 9, 4, 12),
}
const MINUTE = 60_000

test('sunset agrees with an independent calculation to within 3 minutes', () => {
  for (const [city, days] of Object.entries(REFERENCE)) {
    for (const [date, [sunset]] of Object.entries(days)) {
      const [lat, lng] = COORDS[city]
      const gap = Math.abs(sunsetUTC(ANCHOR[date], lat, lng) - sunset) / MINUTE
      assert.ok(gap <= 3, `${city} ${date}: sunset ${gap.toFixed(1)} min from the reference`)
    }
  }
})

test('nightfall (8.5 deg) falls between the 6 and 12 deg twilight ends', () => {
  for (const [city, days] of Object.entries(REFERENCE)) {
    for (const [date, [, civil, nautical]] of Object.entries(days)) {
      const [lat, lng] = COORDS[city]
      const tzeis = tzeisUTC(ANCHOR[date], lat, lng)
      assert.ok(tzeis > civil && tzeis < nautical, `${city} ${date}: nightfall outside the twilight bracket`)
    }
  }
})

test('the sun events land on the intended local date, even far east', () => {
  // Noon UTC is already late evening in Australia; the day must not slip.
  const melbourneDate = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  assert.equal(melbourneDate(tzeisUTC(ANCHOR['2026-09-27'], ...COORDS.melbourne)), '2026-09-27')
  assert.equal(melbourneDate(sunsetUTC(ANCHOR['2026-10-02'], ...COORDS.melbourne)), '2026-10-02')
})

// A moment given as a wall-clock time in a zone, e.g. at('America/New_York', '2026-09-27 19:00').
function at(zone, local) {
  const [date, time] = local.split(' ')
  const guess = Date.parse(`${date}T${time}:00Z`)
  const shown = new Date(guess).toLocaleString('sv-SE', { timeZone: zone }).replace(' ', 'T')
  return guess - (Date.parse(shown + 'Z') - guess)
}

const brooklyn = { city: 'Brooklyn' }
const ny = (t) => at('America/New_York', t)

test('Brooklyn: shut through the first days, open from Motzei Yom Tov', () => {
  assert.equal(soldierLocked(brooklyn, ny('2026-09-26 12:00')), true, 'Shabbos / first day')
  assert.equal(soldierLocked(brooklyn, ny('2026-09-27 19:00')), true, 'second day, before nightfall')
  assert.equal(soldierLocked(brooklyn, ny('2026-09-27 19:45')), false, 'Motzei Yom Tov')
})

test('Brooklyn: open on Chol Hamoed, shut from candle-lighting before Shmini Atzeres', () => {
  assert.equal(soldierLocked(brooklyn, ny('2026-09-30 12:00')), false, 'Chol Hamoed')
  assert.equal(soldierLocked(brooklyn, ny('2026-10-02 17:45')), false, 'Hoshana Rabba afternoon')
  assert.equal(soldierLocked(brooklyn, ny('2026-10-02 18:30')), true, 'after candle-lighting')
  assert.equal(soldierLocked(brooklyn, ny('2026-10-03 12:00')), true, 'Shmini Atzeres')
  assert.equal(soldierLocked(brooklyn, ny('2026-10-04 19:00')), true, 'Simchas Torah, before nightfall')
  assert.equal(soldierLocked(brooklyn, ny('2026-10-04 19:45')), false, 'Motzei Simchas Torah')
  assert.equal(soldierLocked(brooklyn, ny('2026-10-05 12:00')), false, 'Isru Chag')
})

test('each community reopens at its own nightfall, not New York\'s', () => {
  const la = { city: 'Los Angeles' }
  assert.equal(soldierLocked(la, ny('2026-09-27 20:00')), true, 'Motzei in New York is 5 PM, still Yom Tov, in LA')
  assert.equal(soldierLocked(la, at('America/Los_Angeles', '2026-09-27 20:00')), false, 'Motzei Yom Tov in LA')
})

test('Melbourne keeps its own dates', () => {
  const melbourne = { city: 'Melbourne' }
  const mel = (t) => at('Australia/Melbourne', t)
  assert.equal(soldierLocked(melbourne, mel('2026-09-27 17:00')), true, 'second day, before nightfall')
  assert.equal(soldierLocked(melbourne, mel('2026-09-27 20:00')), false, 'Motzei Yom Tov')
  assert.equal(soldierLocked(melbourne, mel('2026-09-28 10:00')), false, 'Chol Hamoed')
  assert.equal(soldierLocked(melbourne, mel('2026-10-02 21:00')), true, 'Shmini Atzeres night')
  assert.equal(soldierLocked(melbourne, mel('2026-10-03 12:00')), true, 'Shmini Atzeres day')
  assert.equal(soldierLocked(melbourne, mel('2026-10-05 12:00')), false, 'Isru Chag')
})

test('explicit coordinates win over the city name, and city names are normalised', () => {
  const laByCoords = { city: 'Brooklyn', lat: 34.05, lng: -118.24 }
  assert.equal(soldierLocked(laByCoords, ny('2026-09-27 20:00')), true, 'coordinates say LA')
  for (const city of ['Brooklyn, NY', '  crown heights ', 'BROOKLYN']) {
    assert.equal(reopenAt({ city }, 0), reopenAt(brooklyn, 0), city)
  }
})

test('a school that cannot be placed stays shut until Yom Tov is over everywhere', () => {
  const nowhere = { city: 'Atlantis' }
  assert.equal(soldierLocked(nowhere, Date.UTC(2026, 8, 28, 5, 59)), true)
  assert.equal(soldierLocked(nowhere, Date.UTC(2026, 8, 28, 6, 1)), false)
  assert.equal(soldierLocked({}, Date.UTC(2026, 8, 28, 5, 59)), true, 'no city at all')
})

// Every community in the lock's own map, read from its source so a city added
// later is covered without touching this test.
const PLACES = [...readFileSync(new URL('../../src/lib/campaignLock.js', import.meta.url), 'utf8')
  .matchAll(/^\s*'([^']+)': \{ lat: (-?[\d.]+), lng: (-?[\d.]+) \}/gm)]
  .map((m) => ({ city: m[1], lat: Number(m[2]), lng: Number(m[3]) }))
const CITIES = PLACES.map((p) => p.city)

// The first minute a school is shut again after Chol Hamoed.
function lastDaysStart(school) {
  for (let t = Date.UTC(2026, 9, 1, 12); t < Date.UTC(2026, 9, 4); t += MINUTE) {
    if (soldierLocked(school, t)) return t
  }
  return null
}

test('the fallback for an unplaced school is never less strict than any known community', () => {
  assert.ok(CITIES.length >= 20, `read ${CITIES.length} cities from campaignLock.js`)
  const nowhere = { city: 'Atlantis' }
  const nowhereFirst = reopenAt(nowhere, 0)
  const nowhereLastStart = lastDaysStart(nowhere)
  const nowhereLastEnd = reopenAt(nowhere, Date.UTC(2026, 9, 3))
  for (const city of CITIES) {
    const school = { city }
    assert.ok(nowhereFirst >= reopenAt(school, 0), `${city}: reopens after the fallback (first days)`)
    assert.ok(nowhereLastStart <= lastDaysStart(school), `${city}: shuts before the fallback (last days)`)
    assert.ok(nowhereLastEnd >= reopenAt(school, Date.UTC(2026, 9, 3)), `${city}: reopens after the fallback (last days)`)
  }
})

test('every known community reopens well after its own sunset on Motzei Yom Tov', () => {
  // Nightfall comes 25-60 minutes after sunset; reopening any sooner than 20
  // minutes after would let someone log while it is still Yom Tov there.
  for (const { city, lat, lng } of PLACES) {
    const reopen = reopenAt({ city }, 0)
    const sunset = sunsetUTC(ANCHOR['2026-09-27'], lat, lng)
    assert.ok(reopen - sunset >= 20 * MINUTE, `${city}: reopens ${((reopen - sunset) / MINUTE).toFixed(0)} min after sunset`)
    assert.ok(soldierLocked({ city }, reopen - MINUTE) && !soldierLocked({ city }, reopen), `${city}: the lock flips exactly at reopening`)
  }
})

test('the reopen notice names a day and a time', () => {
  assert.match(lockReopenText(brooklyn, ny('2026-09-27 12:00')), /Sunday.*\d:\d\d/)
})
