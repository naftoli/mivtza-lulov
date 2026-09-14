// ---------------------------------------------------------------------------
// Mock API layer.
//
// Every function returns a Promise and reads/writes localStorage, so the app
// behaves like it's talking to a real backend. When the Tzivos Hashem backend
// + database are ready, replace the bodies of these functions with real fetch()
// calls — the component code above them never has to change.
//
// MASHPIA.COM: this is the single integration seam. See the adapter skeleton in
// ./mashpia.js and the contract in docs/mashpia-integration.md. To go live,
// route these functions through mashpia.js (e.g. behind an env flag).
// ---------------------------------------------------------------------------

import { SEED } from '../data/seed.js'

const VERSION = 'v9'
const KEYS = {
  schools: `ml_${VERSION}_schools`,
  kids: `ml_${VERSION}_kids`,
  admins: `ml_${VERSION}_admins`,
  shakes: `ml_${VERSION}_shakes`,
  reports: `ml_${VERSION}_reports`,
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
    // Most likely a storage-quota error from large photos.
    console.warn('Could not save to localStorage:', e)
  }
  emit()
}

function emit() {
  listeners.forEach((cb) => cb())
  try {
    window.dispatchEvent(new Event(CHANGED))
  } catch { /* noop */ }
}

// Seed on first run.
function ensureSeed() {
  if (!localStorage.getItem(KEYS.schools)) {
    localStorage.setItem(KEYS.schools, JSON.stringify(SEED.schools))
    localStorage.setItem(KEYS.kids, JSON.stringify(SEED.kids))
    localStorage.setItem(KEYS.admins, JSON.stringify(SEED.admins))
    localStorage.setItem(KEYS.shakes, JSON.stringify(SEED.shakes))
  }
}
ensureSeed()

// Live updates: notify subscribers when data changes (this tab or another tab).
export function subscribe(cb) {
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

// Goals are AUTOMATIC (never picked): 5 shakes per soldier for the base goal,
// and every bonus round adds 1 more shake per soldier.
const PER_KID = 5
const kidCountOf = (s) => s.soldierCount || 0

function decorateSchool(school, shakes) {
  const kids = kidCountOf(school)
  const bonusLevel = school.bonusLevel || 0
  const goal = Math.max(1, kids * PER_KID)
  const activeGoal = Math.max(goal, kids * (PER_KID + bonusLevel))
  // total = shakes already on record (baseline) + everything logged live
  const total = (school.baseline || 0) + loggedTotal(school.id, shakes)
  const goalReached = total >= goal
  return {
    ...school,
    kidCount: kids,
    goal,
    bonusGoal: activeGoal, // current bonus target
    bonusActive: bonusLevel > 0,
    bonusLevel,
    total,
    goalReached,
    activeGoal,
    percent: Math.min(100, Math.round((total / activeGoal) * 100)),
    percentOfBase: Math.min(100, Math.round((total / goal) * 100)),
  }
}

// ---- reads ----
export async function getSchools() {
  await delay()
  const shakes = read(KEYS.shakes, [])
  return read(KEYS.schools, []).map((s) => decorateSchool(s, shakes))
}

export async function getSchool(id) {
  await delay()
  const shakes = read(KEYS.shakes, [])
  const school = read(KEYS.schools, []).find((s) => s.id === id)
  return school ? decorateSchool(school, shakes) : null
}

export async function getShakes(schoolId, { includeHidden = false } = {}) {
  await delay()
  return read(KEYS.shakes, [])
    .filter((s) => s.schoolId === schoolId && (includeHidden || !s.hidden))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicShake)
}

export async function getRecentShakes(schoolId, limit = 8) {
  const all = await getShakes(schoolId)
  return all.slice(0, limit)
}

export async function getLeaderboard(schoolId, limit = 10) {
  await delay()
  const shakes = read(KEYS.shakes, []).filter((s) => s.schoolId === schoolId && !s.hidden)
  const totals = {}
  for (const s of shakes) {
    if (!totals[s.kidId]) totals[s.kidId] = { kidKey: kidKey(s.kidId), name: s.kidName, count: 0, entries: 0 }
    totals[s.kidId].count += s.count
    totals[s.kidId].entries += 1
  }
  return Object.values(totals)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// Class/platoon standings — each class has its OWN goal (kids in class × 5),
// same automatic rule as schools.
export async function getClassLeaderboard(schoolId, limit = 12) {
  await delay()
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
      const goal = Math.max(1, kidCount * PER_KID)
      return { grade: g, count, kidCount, goal, percent: Math.min(100, Math.round((count / goal) * 100)) }
    })
    .sort((a, b) => b.percent - a.percent || b.count - a.count)
    .slice(0, limit)
}

export async function getGlobalStats() {
  await delay()
  const shakes = read(KEYS.shakes, []).filter((s) => !s.hidden)
  const schools = read(KEYS.schools, [])
  const kids = new Set(shakes.map((s) => s.kidId))
  const baseline = schools.reduce((sum, s) => sum + (s.baseline || 0), 0)
  return {
    totalShakes: baseline + shakes.reduce((sum, s) => sum + s.count, 0),
    totalGoal: schools.reduce((sum, s) => sum + kidCountOf(s) * PER_KID, 0), // nationwide goal = every soldier × 5
    totalSchools: schools.length,
    activeSoldiers: kids.size,
    totalPhotos: shakes.filter((s) => s.photo).length,
  }
}

export async function getKidShakes(kidId) {
  await delay()
  return read(KEYS.shakes, [])
    .filter((s) => s.kidId === kidId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// ---- Succos report (the kid-facing version of the teacher checklist) ----
// One editable record per soldier: which days they went out, minutes,
// people shaken with friends, people shaken personally, plus photos/story.
export async function getReport(kidId) {
  await delay()
  const r = read(KEYS.reports, []).find((x) => x.kidId === kidId)
  return r ? clone(r) : null
}

export async function saveReport(kidId, patch) {
  await delay()
  const reports = read(KEYS.reports, [])
  const idx = reports.findIndex((x) => x.kidId === kidId)
  const base = idx >= 0 ? reports[idx] : { kidId }
  const merged = { ...base, ...patch, kidId, updatedAt: new Date().toISOString() }
  if (idx >= 0) reports[idx] = merged
  else reports.push(merged)
  write(KEYS.reports, reports)
  return clone(merged)
}

// For a future admin view (the teacher-style grid across a school).
export async function getReportsForSchool(schoolId) {
  await delay()
  return read(KEYS.reports, []).filter((r) => r.schoolId === schoolId)
}

export async function getKidsForSchool(schoolId) {
  await delay()
  return read(KEYS.kids, []).filter((k) => k.schoolId === schoolId)
}

// ---- auth ----
export async function verifyKid(id, dob) {
  await delay()
  const kid = read(KEYS.kids, []).find(
    (k) => k.id.trim() === id.trim() && k.dob === dob,
  )
  // kidKey is what public rows carry instead of the serial (see publicShake).
  return kid ? { ...clone(kid), kidKey: kidKey(kid.id) } : null
}

export async function verifyAdmin(username, password) {
  await delay()
  const admin = read(KEYS.admins, []).find(
    (a) => a.username === username.trim().toLowerCase() && a.password === password,
  )
  if (!admin) return null
  const { password: _pw, ...safe } = admin
  return clone(safe)
}

// ---- writes ----
export async function addShake({ kid, count, note, photos }) {
  await delay()
  const shakes = read(KEYS.shakes, [])
  const displayName = `${kid.firstName} ${kid.lastName ? kid.lastName[0] + '.' : ''}`.trim()
  const list = (photos || []).filter(Boolean)
  const entry = {
    id: `s${Date.now()}`,
    kidId: kid.id,
    kidName: displayName,
    schoolId: kid.schoolId,
    count: Number(count),
    note: note?.trim() || '', // the optional "story"
    photos: list,
    photo: list[0] || null, // first photo, for compact feed thumbnails
    photoApproved: list.length === 0, // photos start PENDING; approved by an admin
    createdAt: new Date().toISOString(), // system-logged date + time
    hidden: false,
  }
  shakes.push(entry)
  write(KEYS.shakes, shakes)

  // Auto-advance bonus rounds: each round adds 1 shake/kid to the target, so as
  // soon as the current target is passed, the next round kicks in automatically.
  const schools = read(KEYS.schools, [])
  const si = schools.findIndex((s) => s.id === kid.schoolId)
  if (si >= 0) {
    const s = schools[si]
    const kids = kidCountOf(s)
    if (kids > 0) {
      const total = (s.baseline || 0) + loggedTotal(s.id, shakes)
      const neededLevel = Math.max(0, Math.ceil(total / kids) - PER_KID)
      if (neededLevel > (s.bonusLevel || 0)) {
        schools[si] = { ...s, bonusLevel: neededLevel }
        write(KEYS.schools, schools)
      }
    }
  }
  return clone(entry)
}

// ---- photo approval ----
export async function getPendingPhotos(schoolId) {
  await delay()
  return read(KEYS.shakes, [])
    .filter((s) => s.schoolId === schoolId && !s.hidden && !s.photoApproved && (s.photos?.length || s.photo))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function approvePhotos(shakeId) {
  await delay()
  const shakes = read(KEYS.shakes, [])
  const s = shakes.find((x) => x.id === shakeId)
  if (s) s.photoApproved = true
  write(KEYS.shakes, shakes)
  return s ? clone(s) : null
}

// Reject = remove the photos (the shake entry + its count stay).
export async function rejectPhotos(shakeId) {
  await delay()
  const shakes = read(KEYS.shakes, [])
  const s = shakes.find((x) => x.id === shakeId)
  if (s) { s.photos = []; s.photo = null; s.photoApproved = true }
  write(KEYS.shakes, shakes)
  return s ? clone(s) : null
}

export async function setShakeHidden(shakeId, hidden) {
  await delay()
  const shakes = read(KEYS.shakes, [])
  const s = shakes.find((x) => x.id === shakeId)
  if (s) s.hidden = hidden
  write(KEYS.shakes, shakes)
  return clone(s)
}

export async function updateSchool(schoolId, patch) {
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
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
  ensureSeed()
  emit()
}
