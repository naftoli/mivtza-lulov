const BASE = (import.meta.env.VITE_MASHPIA_API || '/mivtzoim/lulav/api').replace(/\/$/, '')
// One token slot per role. A soldier and an admin can be signed in at once on
// the same device — a family or classroom computer — and the API types every
// token, so a single slot meant the second login silently broke the first
// role's screens with 403s.
const TOKEN_KEYS = { kid: 'ml_mashpia_token_kid', admin: 'ml_mashpia_token_admin' }
const memoryTokens = { kid: null, admin: null }
const listeners = new Set()
let timer = null

// Sessions from before the split shared one key, so both roles read whichever
// token was written last. Nothing reads it any more — drop it on load.
try { localStorage.removeItem('ml_mashpia_token') } catch { /* blocked storage */ }

function readToken(role) {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEYS[role]) || 'null')
    if (saved?.token && saved.expiresAt > Date.now()) return saved.token
    localStorage.removeItem(TOKEN_KEYS[role])
  } catch { /* blocked storage */ }
  return memoryTokens[role]
}

function saveToken(role, token, expiresIn) {
  memoryTokens[role] = token
  try {
    localStorage.setItem(TOKEN_KEYS[role], JSON.stringify({
      token,
      expiresAt: Date.now() + Number(expiresIn || 0) * 1000,
    }))
  } catch { /* in-memory requests still work until reload */ }
}

function clearToken(role) {
  memoryTokens[role] = null
  try { localStorage.removeItem(TOKEN_KEYS[role]) } catch { /* noop */ }
}

// Called when a token expires under us, and by the facade on logout. The event
// names the role so the other one's session survives.
export function endSession(role) {
  clearToken(role)
  window.dispatchEvent(new CustomEvent('ml-auth-expired', { detail: { role } }))
}

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener) {
  listeners.add(listener)
  if (!timer) timer = window.setInterval(emit, 30000)
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

/**
 * `as` says whose token to send: 'kid', 'admin', 'admin?' (send an admin token
 * when there is one — /schools/:id/shakes widens for admins and is public
 * otherwise), or nothing at all for the public endpoints.
 */
async function req(path, { method = 'GET', body, as = null } = {}) {
  if (!BASE) throw new Error('Mashpia API base URL is not configured.')
  const role = as === 'admin?' ? 'admin' : as
  const token = role ? readToken(role) : null
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401 && role && token) endSession(role)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`)
  }
  return payload
}

async function write(path, options) {
  const result = await req(path, options)
  emit()
  return result
}

export async function verifyKid(serial, dob) {
  try {
    const { token, expiresIn, soldier } = await req('/soldier/login', {
      method: 'POST',
      body: { serial, dob },
    })
    saveToken('kid', token, expiresIn)
    const { dob: _dob, gender: _gender, ...safe } = soldier
    return safe
  } catch (error) {
    if (/invalid serial|date of birth/i.test(error.message)) return null
    throw error
  }
}

/**
 * The parent site's one-tap sign-in: trade the short-lived code it put in our
 * URL for the same session POST /soldier/login issues.
 */
export async function verifyKidHandoff(code) {
  const { token, expiresIn, soldier } = await req('/soldier/handoff', {
    method: 'POST',
    body: { code },
  })
  saveToken('kid', token, expiresIn)
  const { dob: _dob, gender: _gender, ...safe } = soldier
  return safe
}

export async function verifyAdmin(username, password) {
  try {
    const { token, expiresIn, admin } = await req('/admin/login', {
      method: 'POST',
      body: { username, password },
    })
    saveToken('admin', token, expiresIn)
    return admin
  } catch (error) {
    if (/invalid username|password/i.test(error.message)) return null
    throw error
  }
}

export const getSettings = () => req('/settings', { as: 'admin' })
export const setPerKidGoal = (perKidGoal) =>
  write('/settings', { method: 'PATCH', body: { perKidGoal }, as: 'admin' })
export const setSchoolGoal = (schoolId, goalOverride) =>
  write(`/schools/${schoolId}/goal`, { method: 'PATCH', body: { goalOverride }, as: 'admin' })

export const getSchools = () => req('/schools')
export const getSchool = (id) => req(`/schools/${id}`)
export const getKidsForSchool = (schoolId) => req(`/schools/${schoolId}/soldiers`, { as: 'admin' })
// A school's whole campaign can be thousands of child/day reports, so the public
// feed asks the API for a bounded slice (the newest first). Admin moderation
// still pulls the full set, hidden rows included.
const PUBLIC_SHAKE_LIMIT = 200
export const getShakes = (schoolId, { includeHidden = false, limit } = {}) => {
  const params = new URLSearchParams()
  if (includeHidden) params.set('includeHidden', '1')
  const cap = limit ?? (includeHidden ? null : PUBLIC_SHAKE_LIMIT)
  if (cap) params.set('limit', String(cap))
  const query = params.toString()
  return req(`/schools/${schoolId}/shakes${query ? `?${query}` : ''}`, { as: 'admin?' })
}
export function getRecentShakes(schoolId, limit = 8) {
  return getShakes(schoolId, { limit })
}
export async function getLeaderboard(schoolId, limit = 10) {
  return (await req(`/schools/${schoolId}/leaderboard`)).slice(0, limit)
}
export const getClassLeaderboard = (schoolId) => req(`/schools/${schoolId}/class-leaderboard`)
export const getGlobalStats = () => req('/stats')
// Scoped to the bearer token, so the kidId the facade passes is ignored here:
// a soldier can only ever read their own reports. Admin views go through
// /schools/:id/shakes and /schools/:id/report-rows instead.
export const getKidShakes = () => req('/me/shakes', { as: 'kid' })
export const getKidDayReport = (day) => req(`/me/days/${day}`, { as: 'kid' })
export const getSchoolReportRows = (schoolId) => req(`/schools/${schoolId}/report-rows`, { as: 'admin' })

export const addShake = ({ day, count, minutes, note, photos }) =>
  write(`/me/days/${day}`, { method: 'PUT', body: { count, minutes, note, photos }, as: 'kid' })

export const getPendingPhotos = (schoolId) => req(`/schools/${schoolId}/photos/pending`, { as: 'admin' })
// A short-lived signed link to a zip of the school's approved photos. Plain req,
// not write: asking for a link changes nothing, so nothing needs reloading.
export const getPhotoZipLink = (schoolId) =>
  req(`/schools/${schoolId}/photos/download-link`, { method: 'POST', as: 'admin' })
export const approvePhotos = (shakeId) =>
  write(`/shakes/${shakeId}/photos/approve`, { method: 'POST', as: 'admin' })
export const rejectPhotos = (shakeId) =>
  write(`/shakes/${shakeId}/photos/reject`, { method: 'POST', as: 'admin' })
export async function approveAllPhotos(schoolId) {
  const result = await write(`/schools/${schoolId}/photos/approve-all`, { method: 'POST', as: 'admin' })
  return result.approved
}
// Removes one photo outright — row and file. Rejecting only keeps a photo off
// the public page; this cannot be undone.
export const deletePhoto = (photoId) =>
  write(`/photos/${photoId}`, { method: 'DELETE', as: 'admin' })
export const setShakeHidden = (shakeId, hidden) =>
  write(`/shakes/${shakeId}`, { method: 'PATCH', body: { hidden }, as: 'admin' })
export const updateSchool = (schoolId, patch) =>
  write(`/schools/${schoolId}`, { method: 'PATCH', body: patch, as: 'admin' })

export async function addKid() {
  throw new Error('Soldiers are managed in Mashpia.')
}
export async function resetDemoData() {
  throw new Error('Demo data is not available in production.')
}
