// ---------------------------------------------------------------------------
// Mashpia.com adapter (SKELETON).
//
// This mirrors the surface of ./api.js. When the Mashpia API details are known
// (see docs/mashpia-integration.md), fill in the endpoints below and flip the
// switch in ./api.js to route through here instead of the local mock store.
//
// SECURITY: this runs in the browser. Only use per-user tokens issued at login.
// Never embed a secret API key here — if the API needs one, add a serverless
// proxy and point BASE at it.
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_MASHPIA_API || '' // e.g. https://mashpia.com/api
let authToken = null // set at login

function must() {
  if (!BASE) throw new Error('Mashpia API base URL not configured (VITE_MASHPIA_API).')
}

async function req(path, { method = 'GET', body } = {}) {
  must()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Mashpia ${method} ${path} → ${res.status}`)
  return res.status === 204 ? null : res.json()
}

// ---- auth ----  TODO: confirm endpoints/shape with the Mashpia developer
export async function verifyKid(serial, dob) {
  const { token, soldier } = await req('/soldier/login', { method: 'POST', body: { serial, dob } })
  authToken = token
  // soldier: { serial→id, kidKey (opaque, server-issued), firstName, lastName, hebFirst, hebLast, dob, gender, grade, rank, schoolId }
  // The caller persists this in localStorage — strip the credential (dob) and
  // gender before it leaves the adapter, same as the mock in ./api.js.
  const { dob: _dob, gender: _g, ...safe } = soldier
  return safe
}
export async function verifyAdmin(username, password) {
  const { token, admin } = await req('/admin/login', { method: 'POST', body: { username, password } })
  authToken = token
  return admin
}

// ---- roster (read) ----
export async function getSchools() { return req('/schools') }
export async function getSchool(id) { return req(`/schools/${id}`) }
export async function getKidsForSchool(schoolId) { return req(`/schools/${schoolId}/soldiers`) }

// ---- reports (write) — the teacher-checklist data, self-reported by the kid ----
export async function getReport(serial) { return req(`/soldier/${serial}/lulav-report`) }
export async function saveReport(serial, payload) {
  return req(`/soldier/${serial}/lulav-report`, { method: 'POST', body: payload })
}

// ---- shakes (optional write) ----
export async function addShake(entry) { return req('/shakes', { method: 'POST', body: entry }) }

// NOTE: getShakes, getLeaderboard, getClassLeaderboard, updateSchool, addKid,
// setShakeHidden, getReportsForSchool, etc. map to the corresponding Mashpia
// endpoints the same way — add them once the API is confirmed.
//
// PRIVACY: getShakes / getRecentShakes / getLeaderboard feed UNAUTHENTICATED
// pages. Their rows must carry `kidKey` (the same opaque key the login response
// returns) + display name — never the serial or DOB. See docs/mashpia-integration.md.
