import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../services/api.js'

const AuthContext = createContext(null)

const KID_KEY = 'ml_session_kid'
const ADMIN_KEY = 'ml_session_admin'

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // A saved session from before the login response carried kidKey is stale — re-login.
  const [kid, setKid] = useState(() => { const k = load(KID_KEY); return k?.kidKey ? k : null })
  const [admin, setAdmin] = useState(() => load(ADMIN_KEY))

  useEffect(() => {
    if (kid) localStorage.setItem(KID_KEY, JSON.stringify(kid))
    else localStorage.removeItem(KID_KEY)
  }, [kid])

  useEffect(() => {
    if (admin) localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
    else localStorage.removeItem(ADMIN_KEY)
  }, [admin])

  async function loginKid(id, dob) {
    const found = await api.verifyKid(id, dob)
    if (found) setKid(found)
    return found
  }

  async function loginAdmin(username, password) {
    const found = await api.verifyAdmin(username, password)
    if (found) setAdmin(found)
    return found
  }

  const logoutKid = () => setKid(null)
  const logoutAdmin = () => setAdmin(null)

  return (
    <AuthContext.Provider
      value={{ kid, admin, loginKid, loginAdmin, logoutKid, logoutAdmin }}
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
