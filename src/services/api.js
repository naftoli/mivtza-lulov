// ---------------------------------------------------------------------------
// API facade with a local demo implementation.
//
// Demo localStorage is the default. Add ?real=1 to the URL to use Mashpia.
// ---------------------------------------------------------------------------

import { SEED } from '../data/seed.js'
import { ISRU_CHAG, LULAV_DAYS } from '../lib/succos.js'
import { IS_DEMO } from '../lib/liveMode.js'
import * as mashpia from './mashpia.js'

export { IS_DEMO }

// Exported so the session keys in AuthContext can be versioned with the data:
// a session saved against an older seed must not log a ghost soldier in.
export const VERSION = IS_DEMO ? 'v10' : 'live-v1'
const KEYS = {
  schools: `ml_${VERSION}_schools`,
  kids: `ml_${VERSION}_kids`,
  admins: `ml_${VERSION}_admins`,
  shakes: `ml_${VERSION}_shakes`,
  settings: `ml_${VERSION}_settings`,
}

const listeners = new Set()
const CHANGED = 'ml-data-changed'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // Most likely a storage-quota error from large photos. Fail loudly so the
    // caller can tell the user — never emit() for data that was not saved.
    console.warn('Could not save to localStorage:', e)
    const full = e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014
    throw new Error(full ? 'Could not save — storage is full. Try fewer or smaller photos.' : 'Could not save — please try again.')
  }
  emit()
}

function emit() {
  listeners.forEach((cb) => cb())
  try {
    window.dispatchEvent(new Event(CHANGED))
  } catch { /* noop */ }
}

// Seed on first run. Guarded: this runs at module load, so blocked storage
// (private mode, disabled site data) or a full quota must not crash the app
// before React mounts — reads simply fall back to empty.
function ensureSeed() {
  try {
    if (!localStorage.getItem(KEYS.schools)) {
      localStorage.setItem(KEYS.schools, JSON.stringify(SEED.schools))
      localStorage.setItem(KEYS.kids, JSON.stringify(SEED.kids))
      localStorage.setItem(KEYS.admins, JSON.stringify(SEED.admins))
      localStorage.setItem(KEYS.shakes, JSON.stringify(SEED.shakes))
    }
  } catch (e) {
    console.warn('Could not seed localStorage:', e)
  }
}
ensureSeed()

// Live updates: notify subscribers when data changes (this tab or another tab).
export function subscribe(cb) {
  if (!IS_DEMO) return mashpia.subscribe(cb)
  listeners.add(cb)
  const onStorage = () => cb()
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGED, onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGED, onStorage)
  }
}

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => JSON.parse(JSON.stringify(x))

// Opaque per-kid key for PUBLIC payloads. The serial (kid.id) is half of the
// kid's login credential, so unauthenticated reads (school page feed, photo
// wall, leaderboard) must never carry it — they only need a stable id to key
// rows and to spot "my row". This is a one-way hash of the serial; the real
// backend must issue the same kind of key server-side (e.g. an HMAC with a
// server secret) — see docs/mashpia-integration.md.
function kidKey(serial) {
  let h = 0x811c9dc5 // FNV-1a
  const s = `ml:${serial}`
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

// Public view of a shake entry: everything except the serial, plus the key.
function publicShake({ kidId, ...rest }) {
  return { ...rest, kidKey: kidKey(kidId) }
}

// ---- derived helpers ----
function loggedTotal(schoolId, shakes) {
  return shakes
    .filter((s) => s.schoolId === schoolId && !s.hidden)
    .reduce((sum, s) => sum + s.count, 0)
}

// Goals are automatic unless HQ overrides one school: 3 shakes per soldier by
// default, followed by unlimited bonus rounds, each worth 1 more shake per soldier.
// The per-soldier default. HQ can change it (setPerKidGoal) and it drives every
// automatic goal — school, class and nationwide. Schools never set goals.
const DEFAULT_PER_KID = 3
const kidCountOf = (s) => s.soldierCount || 0

// Current per-soldier default (read synchronously from the settings store).
function perKid() {
  const n = read(KEYS.settings, {}).perKidGoal
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_PER_KID
}

// A school's BASE goal: an HQ-set custom override if present, else soldiers × per-kid.
// No floor — goalPercent() already guards the divisor, and a floor of 1 gave a
// school with no soldiers a phantom target that inflated the nationwide total
// (see the matching note in lulavSchoolRows()).
function baseGoalOf(school, pk = perKid()) {
  const override = Number(school.goalOverride)
  if (Number.isFinite(override) && override >= 1) return Math.floor(override)
  return kidCountOf(school) * pk
}

// HQ: read / change the per-soldier default (applies everywhere at once).
export async function getSettings() {
  if (!IS_DEMO) return mashpia.getSettings()
  await delay()
  return { perKidGoal: perKid() }
}
export async function setPerKidGoal(n) {
  if (!IS_DEMO) return mashpia.setPerKidGoal(n)
  await delay()
  const v = Math.max(1, Math.floor(Number(n) || 0))
  write(KEYS.settings, { ...read(KEYS.settings, {}), perKidGoal: v })
  return { perKidGoal: v }
}

// HQ: set an individual school's goal, or clear it (null / '' / 0) back to automatic.
export async function setSchoolGoal(schoolId, goalOverride) {
  if (!IS_DEMO) return mashpia.setSchoolGoal(schoolId, goalOverride)
  const v = goalOverride === '' || goalOverride == null ? null : Math.max(1, Math.floor(Number(goalOverride) || 0)) || null
  return updateSchool(schoolId, { goalOverride: v })
}

// Percent of a goal, floored and never negative. It is 100 ONLY once the total
// actually reaches the goal — 4,922 of 4,930 is "99%", never "100%" — and keeps
// climbing past 100 through the bonus rounds (bars cap their width; labels don't).
// Must match lulavPercent() in api/index.php.
export function goalPercent(total, goal) {
  return Math.max(0, Math.floor((Number(total) / Math.max(1, Number(goal))) * 100))
}

function decorateSchool(school, shakes) {
  const kids = kidCountOf(school)
  const pk = perKid()
  const goal = baseGoalOf(school, pk) // HQ override, else soldiers × per-kid
  const goalCustom = Number.isFinite(Number(school.goalOverride)) && Number(school.goalOverride) >= 1
  // total = shakes already on record (baseline) + everything logged live
  const total = (school.baseline || 0) + loggedTotal(school.id, shakes)
  // goal > 0 guard: 0 >= 0 would badge every empty school as goal-complete.
  const goalReached = goal > 0 && total >= goal
  // Bonus rounds never run out. Reaching the goal starts round 1; each round's
  // target is one more shake per soldier than the last, and the next round starts
  // the moment a target is reached — so bonusGoal is always still ahead of total.
  // Derived on every read (never stored), so hiding entries or changing a goal
  // moves the round at once. Must match lulavSchoolRows() in api/index.php.
  const step = Math.max(1, kids)
  const bonusLevel = goalReached ? Math.floor((total - goal) / step) + 1 : 0
  const bonusGoal = goal + Math.max(1, bonusLevel) * step // round 1's target until the goal is reached
  return {
    ...school,
    endDate: ISRU_CHAG, // fixed campaign end (Isru Chag) — not set by anyone
    kidCount: kids,
    perKidGoal: pk,
    goalCustom,
    goal,
    bonusLevel,
    bonusGoal,
    bonusActive: goalReached,
    total,
    goalReached,
    percent: goalPercent(total, goal),
    percentOfBase: goalPercent(total, goal),
  }
}

// ---- reads ----
// A registered school with no registered children (e.g. a summer camp) has nobody
// who can log in and a goal of 0, so it would sit at "0 of 0" forever — it is left
// out of every school list. Single-school lookups (getSchool) are not filtered, so
// an admin of such a school still gets their page rather than a crash.
const hasSoldiers = (s) => Number(s?.kidCount ?? s?.soldierCount ?? 0) > 0

export async function getSchools() {
  if (!IS_DEMO) return ((await mashpia.getSchools()) || []).filter(hasSoldiers)
  await delay()
  const shakes = read(KEYS.shakes, [])
  return read(KEYS.schools, []).map((s) => decorateSchool(s, shakes)).filter(hasSoldiers)
}

export async function getSchool(id) {
  if (!IS_DEMO) return mashpia.getSchool(id)
  await delay()
  const shakes = read(KEYS.shakes, [])
  const school = read(KEYS.schools, []).find((s) => s.id === id)
  return school ? decorateSchool(school, shakes) : null
}

export async function getShakes(schoolId, { includeHidden = false, limit } = {}) {
  if (!IS_DEMO) return mashpia.getShakes(schoolId, { includeHidden, limit })
  await delay()
  // Public rows carry the child's rank (never the serial). New entries store it,
  // but backfill from the roster so seeded/older entries expose it too.
  const rankOf = {}
  for (const k of read(KEYS.kids, [])) {
    if (k.schoolId === schoolId) rankOf[k.id] = { name: k.rank || '', image: k.rankImageUrl || null }
  }
  const rows = read(KEYS.shakes, [])
    .filter((s) => s.schoolId === schoolId && (includeHidden || !s.hidden))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((s) => publicShake({
      ...s,
      rank: s.rank || rankOf[s.kidId]?.name || '',
      rankImageUrl: s.rankImageUrl || rankOf[s.kidId]?.image || null,
    }))
  // Match the live API, which caps the public feed server-side.
  return limit ? rows.slice(0, limit) : rows
}

export async function getRecentShakes(schoolId, limit = 8) {
  if (!IS_DEMO) return mashpia.getRecentShakes(schoolId, limit)
  const all = await getShakes(schoolId)
  return all.slice(0, limit)
}

export async function getLeaderboard(schoolId, limit = 10) {
  if (!IS_DEMO) return mashpia.getLeaderboard(schoolId, limit)
  await delay()
  const shakes = read(KEYS.shakes, []).filter((s) => s.schoolId === schoolId && !s.hidden)
  // Map serial → rank so rows can carry the rank without ever exposing the serial.
  const rankOf = {}
  for (const k of read(KEYS.kids, [])) {
    if (k.schoolId === schoolId) rankOf[k.id] = { name: k.rank || '', image: k.rankImageUrl || null }
  }
  const totals = {}
  for (const s of shakes) {
    if (!totals[s.kidId]) totals[s.kidId] = {
      kidKey: kidKey(s.kidId),
      name: s.kidName,
      rank: rankOf[s.kidId]?.name || s.rank || '',
      rankImageUrl: rankOf[s.kidId]?.image || s.rankImageUrl || null,
      count: 0,
      entries: 0,
    }
    totals[s.kidId].count += s.count
    totals[s.kidId].entries += 1
  }
  return Object.values(totals)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// Class/platoon standings — each class has its OWN goal (kids in class × the
// per-soldier default), same automatic rule as schools. Every class is returned:
// big schools run 40-50 platoons, and a cap hid most of them.
export async function getClassLeaderboard(schoolId) {
  if (!IS_DEMO) return mashpia.getClassLeaderboard(schoolId)
  await delay()
  const pk = perKid()
  const kidsAll = read(KEYS.kids, []).filter((k) => k.schoolId === schoolId)
  const shakes = read(KEYS.shakes, []).filter((s) => s.schoolId === schoolId && !s.hidden)
  const gradeOf = {}
  const classKids = {}
  for (const k of kidsAll) {
    const g = k.grade || '—'
    gradeOf[k.id] = g
    classKids[g] = (classKids[g] || 0) + 1
  }
  const shaken = {}
  for (const s of shakes) {
    const g = gradeOf[s.kidId] || '—'
    shaken[g] = (shaken[g] || 0) + s.count
  }
  const grades = new Set([...Object.keys(classKids), ...Object.keys(shaken)])
  return [...grades]
    .map((g) => {
      const count = shaken[g] || 0
      const kidCount = classKids[g] || 0
      const goal = kidCount * pk
      return { grade: g, count, kidCount, goal, percent: goalPercent(count, goal) }
    })
    .sort((a, b) => b.percent - a.percent || a.grade.localeCompare(b.grade, undefined, { numeric: true, sensitivity: 'base' }))
}

export async function getGlobalStats() {
  if (!IS_DEMO) return mashpia.getGlobalStats()
  await delay()
  const all = read(KEYS.shakes, [])
  const shakes = all.filter((s) => !s.hidden)
  const schools = read(KEYS.schools, [])
  const baseline = schools.reduce((sum, s) => sum + (s.baseline || 0), 0)
  // Same meanings as the live /stats (api/index.php): soldiers = registered
  // headcount, photos = approved photos (each one, hidden entries included).
  return {
    totalShakes: baseline + shakes.reduce((sum, s) => sum + s.count, 0),
    totalGoal: schools.reduce((sum, s) => sum + baseGoalOf(s), 0), // nationwide = sum of every school's base goal
    totalSchools: schools.length,
    activeSoldiers: schools.reduce((sum, s) => sum + kidCountOf(s), 0),
    totalPhotos: all
      .filter((s) => s.photoApproved)
      .reduce((n, s) => n + (s.photos?.length || (s.photo ? 1 : 0)), 0),
  }
}

export async function getKidShakes(kidId) {
  if (!IS_DEMO) return mashpia.getKidShakes(kidId)
  await delay()
  return read(KEYS.shakes, [])
    .filter((s) => s.kidId === kidId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// ---- Admin report grid ----
// The teacher-checklist grid is now DERIVED from the soldiers' own shake entries
// (the separate report store is gone). One row per soldier in the school:
//   { id, name, grade, rank, perDay: {2:n,…,7:n}, totalShakes, totalMinutes }
// where perDay sums each Lulav day's shake count. `id` is the serial — this is an
// AUTHENTICATED admin view, so it's fine here (never in a public payload).
export async function getSchoolReportRows(schoolId) {
  if (!IS_DEMO) return mashpia.getSchoolReportRows(schoolId)
  await delay()
  const kids = read(KEYS.kids, []).filter((k) => k.schoolId === schoolId)
  const shakes = read(KEYS.shakes, []).filter((s) => s.schoolId === schoolId && !s.hidden)
  const byKid = {}
  for (const k of kids) {
    byKid[k.id] = {
      id: k.id,
      name: `${k.firstName} ${k.lastName}`.trim(),
      grade: k.grade || '',
      rank: k.rank || '',
      perDay: Object.fromEntries(LULAV_DAYS.map((d) => [d, 0])),
      totalShakes: 0,
      totalMinutes: 0,
    }
  }
  for (const s of shakes) {
    const row = byKid[s.kidId]
    if (!row) continue
    const c = Number(s.count) || 0
    row.totalShakes += c
    row.totalMinutes += Number(s.minutes) || 0
    if (s.day != null && row.perDay[s.day] != null) row.perDay[s.day] += c
  }
  return Object.values(byKid).sort(
    (a, b) => String(a.grade).localeCompare(String(b.grade)) || String(a.name).localeCompare(String(b.name)),
  )
}

export async function getKidsForSchool(schoolId) {
  if (!IS_DEMO) return mashpia.getKidsForSchool(schoolId)
  await delay()
  return read(KEYS.kids, []).filter((k) => k.schoolId === schoolId)
}

// ---- auth ----
export async function verifyKid(id, dob) {
  if (!IS_DEMO) return mashpia.verifyKid(id, dob)
  await delay()
  const kid = read(KEYS.kids, []).find(
    (k) => k.id.trim() === id.trim() && k.dob === dob,
  )
  if (!kid) return null
  // Never hand the credential back: dob is half of the login and gender is not
  // needed by any screen. AuthContext persists this object, so what leaves
  // here is what sits in localStorage.
  const { dob: _dob, gender: _g, ...safe } = kid
  // kidKey is what public rows carry instead of the serial (see publicShake).
  return { ...clone(safe), kidKey: kidKey(kid.id) }
}

export async function verifyAdmin(username, password) {
  if (!IS_DEMO) return mashpia.verifyAdmin(username, password)
  await delay()
  const admin = read(KEYS.admins, []).find(
    (a) => a.username === username.trim().toLowerCase() && a.password === password,
  )
  if (!admin) return null
  const { password: _pw, ...safe } = admin
  return clone(safe)
}

export async function getKidDayReport(kidId, day) {
  if (!IS_DEMO) return mashpia.getKidDayReport(day)
  await delay()
  const report = read(KEYS.shakes, []).find(
    (shake) => shake.kidId === kidId && Number(shake.day) === Number(day),
  )
  return report ? clone(report) : {
    day: Number(day),
    count: 0,
    minutes: 0,
    note: '',
    photos: [],
  }
}

// ---- writes ----
export async function addShake({ kid, day, count, minutes, note, photos }) {
  if (!IS_DEMO) return mashpia.addShake({ kid, day, count, minutes, note, photos })
  await delay()
  const shakes = read(KEYS.shakes, [])
  const displayName = `${kid.firstName} ${kid.lastName ? kid.lastName[0] + '.' : ''}`.trim()
  const list = (photos || []).filter(Boolean)
  const existing = shakes.find(
    (shake) => shake.kidId === kid.id && Number(shake.day) === Number(day),
  )
  const hasNewPhoto = list.some((photo) => !(existing?.photos || []).includes(photo))
  const entry = {
    ...(existing || {}),
    id: existing?.id || `s${Date.now()}`,
    kidId: kid.id,
    kidName: displayName,
    schoolId: kid.schoolId,
    rank: kid.rank || '',
    rankImageUrl: kid.rankImageUrl || null,
    day: Number(day),
    count: Math.max(Number(existing?.count) || 0, Number(count) || 0),
    minutes: Math.max(Number(existing?.minutes) || 0, Number(minutes) || 0),
    note: note?.trim() || '',
    photos: list,
    photo: list[0] || null,
    photoApproved: list.length === 0 ? true : hasNewPhoto ? false : Boolean(existing?.photoApproved),
    createdAt: new Date().toISOString(),
    hidden: false,
  }
  if (existing) shakes[shakes.indexOf(existing)] = entry
  else shakes.push(entry)
  write(KEYS.shakes, shakes) // throws if nothing was saved — nothing below runs
  return clone(entry)
}

// ---- photo approval ----
export async function getPendingPhotos(schoolId) {
  if (!IS_DEMO) return mashpia.getPendingPhotos(schoolId)
  await delay()
  return read(KEYS.shakes, [])
    .filter((s) => s.schoolId === schoolId && !s.hidden && !s.photoApproved && (s.photos?.length || s.photo))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function approvePhotos(shakeId) {
  if (!IS_DEMO) return mashpia.approvePhotos(shakeId)
  await delay()
  const shakes = read(KEYS.shakes, [])
  const s = shakes.find((x) => x.id === shakeId)
  if (s) s.photoApproved = true
  write(KEYS.shakes, shakes)
  return s ? clone(s) : null
}

// Bulk approve: flips every pending entry in the school (same set getPendingPhotos returns).
// Returns the number of entries approved.
export async function approveAllPhotos(schoolId) {
  if (!IS_DEMO) return mashpia.approveAllPhotos(schoolId)
  await delay()
  const shakes = read(KEYS.shakes, [])
  let n = 0
  shakes.forEach((s) => {
    if (s.schoolId === schoolId && !s.hidden && !s.photoApproved && (s.photos?.length || s.photo)) {
      s.photoApproved = true
      n++
    }
  })
  if (n > 0) write(KEYS.shakes, shakes)
  return n
}

// Reject = remove the photos (the shake entry + its count stay).
export async function rejectPhotos(shakeId) {
  if (!IS_DEMO) return mashpia.rejectPhotos(shakeId)
  await delay()
  const shakes = read(KEYS.shakes, [])
  const s = shakes.find((x) => x.id === shakeId)
  if (s) { s.photos = []; s.photo = null; s.photoApproved = true }
  write(KEYS.shakes, shakes)
  return s ? clone(s) : null
}

export async function setShakeHidden(shakeId, hidden) {
  if (!IS_DEMO) return mashpia.setShakeHidden(shakeId, hidden)
  await delay()
  const shakes = read(KEYS.shakes, [])
  const s = shakes.find((x) => x.id === shakeId)
  if (s) s.hidden = hidden
  write(KEYS.shakes, shakes)
  return clone(s)
}

export async function updateSchool(schoolId, patch) {
  if (!IS_DEMO) return mashpia.updateSchool(schoolId, patch)
  await delay()
  const schools = read(KEYS.schools, [])
  const idx = schools.findIndex((s) => s.id === schoolId)
  if (idx === -1) return null
  schools[idx] = { ...schools[idx], ...patch }
  write(KEYS.schools, schools)
  const shakes = read(KEYS.shakes, [])
  return decorateSchool(schools[idx], shakes)
}

export async function addKid(schoolId, { id, dob, firstName, lastName, grade }) {
  if (!IS_DEMO) return mashpia.addKid(schoolId, { id, dob, firstName, lastName, grade })
  await delay()
  const kids = read(KEYS.kids, [])
  if (kids.some((k) => k.id === id.trim())) {
    throw new Error('A soldier with that serial number already exists.')
  }
  const kid = {
    id: id.trim(),
    dob,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    grade: grade?.trim() || '',
    schoolId,
  }
  kids.push(kid)
  write(KEYS.kids, kids)
  // keep the school's headcount (which drives the auto goal) in step
  const schools = read(KEYS.schools, [])
  const si = schools.findIndex((s) => s.id === schoolId)
  if (si >= 0) {
    schools[si] = { ...schools[si], soldierCount: (schools[si].soldierCount || 0) + 1 }
    write(KEYS.schools, schools)
  }
  return clone(kid)
}

// Demo helper: wipe localStorage and reload from seed.
export async function resetDemoData() {
  if (!IS_DEMO) return mashpia.resetDemoData()
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
  ensureSeed()
  emit()
}
