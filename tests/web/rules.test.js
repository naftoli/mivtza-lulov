// The site's rules, and the ones the PHP API has to apply identically.
//
// Several rules live twice -- once in the browser, once in api/ -- with a
// "must match" comment between them. These tests read the PHP side and compare,
// so a change to one side that misses the other fails here instead of showing
// two different numbers on the site.
//
//   node --test 'tests/web/*.test.js'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { HIGH_SHAKES, HIGH_MINUTES, highReasons, isHighEntry, isHighInput } from '../../src/lib/highNumber.js'
import { CAMPAIGN_YEAR, SHABBOS_DAY, LULAV_DAYS, ISRU_CHAG, ordinal } from '../../src/lib/succos.js'
import { entryPhotos, approvedPhotos, pendingPhotos, pendingPhotoItems } from '../../src/lib/photos.js'
import { fmt, shortSchoolName, timeAgo } from '../../src/lib/format.js'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const phpConst = (file, name) => {
  const match = read(file).match(new RegExp(`const ${name} = '?([^';]+)'?;`))
  assert.ok(match, `${name} not found in ${file}`)
  return match[1]
}

// --- high-number flags ------------------------------------------------------

test('the high-number limits are the ones the API emails on', () => {
  assert.equal(HIGH_SHAKES, Number(phpConst('api/index.php', 'LULAV_ALERT_SHAKES')))
  assert.equal(HIGH_MINUTES, Number(phpConst('api/index.php', 'LULAV_ALERT_MINUTES')))
})

test('a day is flagged at the limits, not one below', () => {
  assert.deepEqual(highReasons({ count: 49, minutes: 179 }), [])
  assert.deepEqual(highReasons({ count: 50, minutes: 0 }), ['50 shakes in one day'])
  assert.deepEqual(highReasons({ count: 0, minutes: 180 }), ['180 minutes in one day'])
  assert.equal(highReasons({ count: 60, minutes: 200 }).length, 2)
  assert.equal(isHighInput({ count: '50', minutes: '' }), true, 'form values arrive as strings')
  assert.equal(isHighInput({ count: 49, minutes: 179 }), false)
})

test("the server's own flag wins when it sends one", () => {
  assert.deepEqual(highReasons({ count: 1, flagReason: 'Checked by HQ' }), ['Checked by HQ'])
  assert.equal(isHighEntry({ count: 1, flagged: true }), true)
  assert.equal(isHighEntry(null), false)
  assert.deepEqual(highReasons(undefined), [])
})

// --- the Sukkos calendar ----------------------------------------------------

test('5787: Shabbos is the first day, so Lulav is taken on days 2-7', () => {
  assert.equal(CAMPAIGN_YEAR, 5787)
  assert.equal(SHABBOS_DAY, 1)
  // Production's lulav_api_task_map for 5787 maps exactly these six days (checked
  // against the database 2026-09-23); the API refuses to save with any other set.
  assert.deepEqual(LULAV_DAYS, [2, 3, 4, 5, 6, 7])
  assert.equal(ISRU_CHAG, '2026-10-05')
})

test("the API's sign-in gate opens on the first Lulav day's date", () => {
  // bootstrap.php opens soldier sign-in at sunset on LULAV_KID_LOGIN_OPENS_DATE,
  // meant to be the evening the first days of Yom Tov end. When SUKKOS_START is
  // moved next year this fails until the PHP date moves with it.
  const start = read('src/lib/succos.js').match(/SUKKOS_START = '([\d-]+)'/)[1]
  const firstLulavDay = new Date(Date.parse(start + 'T12:00:00Z') + (LULAV_DAYS[0] - 1) * 86400000).toISOString().slice(0, 10)
  assert.equal(phpConst('api/bootstrap.php', 'LULAV_KID_LOGIN_OPENS_DATE'), firstLulavDay)
})

test('ordinals', () => {
  const cases = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 11: '11th', 12: '12th', 13: '13th', 21: '21st', 22: '22nd', 101: '101st', 111: '111th' }
  for (const [n, expected] of Object.entries(cases)) assert.equal(ordinal(Number(n)), expected)
})

// --- goal percent: browser and API must agree ---------------------------------

// api.js cannot be imported outside Vite (mashpia.js reads import.meta.env as it
// loads), so goalPercent is lifted out of its source -- as send-sample-alert.php
// lifts lulavSendMail() -- and so is lulavPercent from index.php.
function liftGoalPercent() {
  const source = read('src/services/api.js')
  const body = source.match(/export function goalPercent\(total, goal\) \{([\s\S]*?)\n\}/)
  assert.ok(body, 'goalPercent not found in api.js')
  return new Function('total', 'goal', body[1])
}

function phpAvailable() {
  try {
    execFileSync('php', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

test('goalPercent (browser) and lulavPercent (API) agree everywhere', { skip: !phpAvailable() && 'php is not installed' }, () => {
  const goalPercent = liftGoalPercent()
  const totals = [...Array(301).keys(), 4922, 4925, 4929, 4930, 4931, 9860]
  const goals = [0, 1, 2, 3, 6, 7, 9, 10, 33, 60, 99, 4930]
  const php = `
    $src = file_get_contents('api/index.php');
    preg_match('/function lulavPercent\\(int \\$total, int \\$goal\\): int\\s*\\{.*?\\n\\}/s', $src, $m);
    eval($m[0]);
    $out = [];
    foreach (json_decode($argv[1]) as $t) foreach (json_decode($argv[2]) as $g) $out[] = lulavPercent($t, $g);
    echo json_encode($out);`
  const cwd = new URL('../../', import.meta.url).pathname
  const fromPhp = JSON.parse(execFileSync('php', ['-r', php, JSON.stringify(totals), JSON.stringify(goals)], { cwd, encoding: 'utf8' }))
  let i = 0
  for (const t of totals) {
    for (const g of goals) {
      assert.equal(goalPercent(t, g), fromPhp[i++], `total ${t}, goal ${g}`)
    }
  }
  assert.equal(i, totals.length * goals.length)
})

test('goalPercent never shows 100 before the goal is met', () => {
  const goalPercent = liftGoalPercent()
  assert.equal(goalPercent(4922, 4930), 99, '99.8% reads 99, not 100')
  assert.equal(goalPercent(4930, 4930), 100)
  assert.equal(goalPercent(9860, 4930), 200, 'bonus rounds climb past 100')
  assert.equal(goalPercent(5, 0), 500, 'a zero goal never divides by zero')
  assert.equal(goalPercent(-3, 10), 0)
})

// --- photos on an entry -------------------------------------------------------

test('photos: live entries mark approval per photo, demo entries per entry', () => {
  const live = { photos: ['a', 'b', 'c'], approvedPhotos: ['a'], photoIds: ['1', '2', '3'] }
  assert.deepEqual(entryPhotos(live), ['a', 'b', 'c'])
  assert.deepEqual(approvedPhotos(live), ['a'])
  assert.deepEqual(pendingPhotos(live), ['b', 'c'])
  assert.deepEqual(pendingPhotoItems(live), [{ photo: 'b', id: '2' }, { photo: 'c', id: '3' }])

  const demo = { photo: 'x', photoApproved: true }
  assert.deepEqual(entryPhotos(demo), ['x'], 'older entries carry a single photo')
  assert.deepEqual(approvedPhotos(demo), ['x'])
  assert.deepEqual(pendingPhotoItems({ photos: ['y'] }), [{ photo: 'y', id: null }], 'no ids in demo')
  assert.deepEqual(entryPhotos({}), [])
})

// --- formatting ---------------------------------------------------------------

test('numbers', () => {
  assert.equal(fmt(1234567), '1,234,567')
  assert.equal(fmt(null), '0')
  assert.equal(fmt(undefined), '0')
})

test('school names drop their own city, however it is spelled', () => {
  assert.equal(shortSchoolName({ name: 'Cheder Menachem LA', city: 'Los Angeles' }), 'Cheder Menachem')
  assert.equal(shortSchoolName({ name: 'Cheder Menachem Los Angeles', city: 'LA' }), 'Cheder Menachem')
  assert.equal(shortSchoolName({ name: 'Bais Chaya Mushka L. A.', city: 'L. A.' }), 'Bais Chaya Mushka')
  assert.equal(shortSchoolName({ name: 'Oholei Torah', city: 'Brooklyn, NY' }), 'Oholei Torah')
  assert.equal(shortSchoolName({ name: 'Brooklyn', city: 'Brooklyn' }), 'Brooklyn', 'never blanked')
  assert.equal(shortSchoolName({ name: 'Yeshiva', city: '' }), 'Yeshiva')
})

test('school names survive cities that would break a regular expression', () => {
  // school_city is free text from the database; these used to throw during render.
  for (const city of ['(', '[x', 'a+b*', '.*', 'constructor', '__proto__']) {
    assert.equal(typeof shortSchoolName({ name: 'Some School', city }), 'string', city)
  }
})

test('relative times', () => {
  const ago = (ms) => new Date(Date.now() - ms).toISOString()
  assert.equal(timeAgo(ago(10_000)), 'just now')
  assert.equal(timeAgo(ago(5 * 60_000)), '5 min ago')
  assert.equal(timeAgo(ago(3 * 3_600_000)), '3 hr ago')
  assert.equal(timeAgo(ago(26 * 3_600_000)), '1 day ago')
  assert.equal(timeAgo(ago(3 * 86_400_000)), '3 days ago')
})
