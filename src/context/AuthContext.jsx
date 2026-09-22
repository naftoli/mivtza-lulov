import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../services/api.js'

const AuthContext = createContext(null)

// Session keys carry the data VERSION so a session saved against an older seed
// (a kid record that no longer exists) cannot log a ghost soldier in.
const KID_KEY = `ml_${api.VERSION}_session_kid`
const ADMIN_KEY = `ml_${api.VERSION}_session_admin`

// Absolute expiry from login (not sliding): a shared school/family device must
// not stay logged in indefinitely. Checked on load.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    const saved = raw ? JSON.parse(raw) : null
    if (saved?.data && saved.exp > Date.now()) return saved.data
    if (raw) localStorage.removeItem(key)
    return null
  } catch {
    return null
  }
}

// Pre-versioning sessions stored the full kid record (incl. dob) under these
// keys with no expiry. Nothing reads them any more — purge them on load.
for (const legacy of ['ml_session_kid', 'ml_session_admin']) {
  try { localStorage.removeItem(legacy) } catch { /* noop */ }
}

function save(key, data) {
  try {
    if (data) localStorage.setItem(key, JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, data }))
    else localStorage.removeItem(key)
  } catch { /* blocked storage: the in-memory session still works for this tab */ }
}

export function AuthProvider({ children }) {
  // A saved session from before the login response carried kidKey is stale — re-login.
  const [kid, setKid] = useState(() => { const k = load(KID_KEY); return k?.kidKey ? k : null })
  const [admin, setAdmin] = useState(() => load(ADMIN_KEY))

  useEffect(() => {
    // A token that expired under us. The event names the role whose token it
    // was, so a soldier and an admin signed in on the same device do not log
    // each other out; an event with no role clears both.
    const expire = (event) => {
      const role = event?.detail?.role
      if (role !== 'admin') {
        setKid(null)
        save(KID_KEY, null)
      }
      if (role !== 'kid') {
        setAdmin(null)
        save(ADMIN_KEY, null)
      }
    }
    window.addEventListener('ml-auth-expired', expire)
    return () => window.removeEventListener('ml-auth-expired', expire)
  }, [])

  async function loginKid(id, dob) {
    const found = await api.verifyKid(id, dob)
    if (found) {
      // verifyKid already strips dob/gender; the session holds only display
      // fields + the opaque kidKey (used to highlight the kid's own rows).
      setKid(found)
      save(KID_KEY, found)
    }
    return found
  }

  // Same session as loginKid(), from the parent site's code instead of the
  // child's serial + date of birth.
  async function loginKidWithHandoff(code) {
    const found = await api.verifyKidHandoff(code)
    if (found) {
      setKid(found)
      save(KID_KEY, found)
    }
    return found
  }

  async function loginAdmin(username, password) {
    const found = await api.verifyAdmin(username, password)
    if (found) {
      setAdmin(found)
      save(ADMIN_KEY, found)
    }
    return found
  }

  // Logging out drops the API token too: it outlives the screen by hours
  // otherwise, which matters most on the shared devices this runs on.
  const logoutKid = () => { setKid(null); save(KID_KEY, null); api.endSession('kid') }
  const logoutAdmin = () => { setAdmin(null); save(ADMIN_KEY, null); api.endSession('admin') }

  return (
    <AuthContext.Provider
      value={{ kid, admin, loginKid, loginKidWithHandoff, loginAdmin, logoutKid, logoutAdmin }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
