const BASE = (
  import.meta.env.VITE_MASHPIA_API
  || (import.meta.env.PROD ? '/mivtzoim/lulav/api' : '')
).replace(/\/$/, '')
const TOKEN_KEY = 'ml_mashpia_token'
const listeners = new Set()
let timer = null
let memoryToken = null

function readToken() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
    if (saved?.token && saved.expiresAt > Date.now()) return saved.token
    localStorage.removeItem(TOKEN_KEY)
  } catch { /* blocked storage */ }
  return memoryToken
}

function saveToken(token, expiresIn) {
  memoryToken = token
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      token,
      expiresAt: Date.now() + Number(expiresIn || 0) * 1000,
    }))
  } catch { /* in-memory requests still work until reload */ }
}

function clearToken() {
  memoryToken = null
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* noop */ }
  window.dispatchEvent(new Event('ml-auth-expired'))
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

async function req(path, { method = 'GET', body } = {}) {
  if (!BASE) throw new Error('Mashpia API base URL is not configured.')
  const token = readToken()
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401) clearToken()
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
    saveToken(token, expiresIn)
    const { dob: _dob, gender: _gender, ...safe } = soldier
    return safe
  } catch (error) {
    if (/invalid serial|date of birth/i.test(error.message)) return null
    throw error
  }
}

export async function verifyAdmin(username, password) {
  try {
    const { token, expiresIn, admin } = await req('/admin/login', {
      method: 'POST',
      body: { username, password },
    })
    saveToken(token, expiresIn)
    return admin
  } catch (error) {
    if (/invalid username|password/i.test(error.message)) return null
    throw error
  }
}

export const getSettings = () => req('/settings')
export const setPerKidGoal = (perKidGoal) =>
  write('/settings', { method: 'PATCH', body: { perKidGoal } })
export const setSchoolGoal = (schoolId, goalOverride) =>
  write(`/schools/${schoolId}/goal`, { method: 'PATCH', body: { goalOverride } })

export const getSchools = () => req('/schools')
export const getSchool = (id) => req(`/schools/${id}`)
export const getKidsForSchool = (schoolId) => req(`/schools/${schoolId}/soldiers`)
export const getShakes = (schoolId, { includeHidden = false } = {}) =>
  req(`/schools/${schoolId}/shakes${includeHidden ? '?includeHidden=1' : ''}`)
export async function getRecentShakes(schoolId, limit = 8) {
  return (await getShakes(schoolId)).slice(0, limit)
}
export async function getLeaderboard(schoolId, limit = 10) {
  return (await req(`/schools/${schoolId}/leaderboard`)).slice(0, limit)
}
export async function getClassLeaderboard(schoolId, limit = 12) {
  return (await req(`/schools/${schoolId}/class-leaderboard`)).slice(0, limit)
}
export const getGlobalStats = () => req('/stats')
export const getKidShakes = () => req('/me/shakes')
export const getKidDayReport = (day) => req(`/me/days/${day}`)
export const getSchoolReportRows = (schoolId) => req(`/schools/${schoolId}/report-rows`)

export const addShake = ({ day, count, minutes, note, photos }) =>
  write(`/me/days/${day}`, { method: 'PUT', body: { count, minutes, note, photos } })

export const getPendingPhotos = (schoolId) => req(`/schools/${schoolId}/photos/pending`)
export const approvePhotos = (shakeId) =>
  write(`/shakes/${shakeId}/photos/approve`, { method: 'POST' })
export const rejectPhotos = (shakeId) =>
  write(`/shakes/${shakeId}/photos/reject`, { method: 'POST' })
export async function approveAllPhotos(schoolId) {
  const result = await write(`/schools/${schoolId}/photos/approve-all`, { method: 'POST' })
  return result.approved
}
export const setShakeHidden = (shakeId, hidden) =>
  write(`/shakes/${shakeId}`, { method: 'PATCH', body: { hidden } })
export const updateSchool = (schoolId, patch) =>
  write(`/schools/${schoolId}`, { method: 'PATCH', body: patch })

export async function addKid() {
  throw new Error('Soldiers are managed in Mashpia.')
}
export async function resetDemoData() {
  throw new Error('Demo data is not available in production.')
}
