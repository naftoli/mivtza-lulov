import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Card, Field, Input, Band } from '../components/ui.jsx'
import { asset } from '../lib/asset.js'
import { SEED } from '../data/seed.js'

// Dev-only login hint, derived from the seeded demo admins so it can't drift.
// `import.meta.env.DEV` is false in `vite build`, so this never ships to production.
function DemoHint() {
  const hq = SEED.admins.find((a) => a.role === 'hq')
  const school = SEED.admins.find((a) => a.role === 'school')
  if (!hq || !school) return null
  return (
    <p className="mt-5 rounded-xl bg-white/55 px-3 py-2 text-center text-xs text-muted">
      <strong className="text-navy">Demo:</strong> HQ → <code>{hq.username}</code> / <code>{hq.password}</code> · School → <code>{school.username}</code> / <code>{school.password}</code>
    </p>
  )
}

export default function AdminLogin() {
  const { loginAdmin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const admin = await loginAdmin(username, password)
      if (admin) navigate('/admin')
      else setError('Incorrect username or password.')
    } catch (err) {
      // verifyAdmin() only swallows bad credentials; a 429 from the login rate
      // limiter, a 403 for an account that administers no school, or a 503
      // reached here unhandled and left the button stuck on "Signing in…".
      setError(err?.message || 'We could not reach the base right now. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {/* sky card on the mint page: shield, Exo heading, condensed pill submit */}
      <Card className="overflow-hidden">
        <Band />
        <div className="p-6 sm:p-8">
          <img src={asset('th-logo.svg')} alt="" className="mx-auto h-16 w-auto" />
          {/* MASHPIA: school login will sync with mashpia.com — schools reach this
              screen through a PRIVATE link (not surfaced in the public nav). */}
          <h1 className="mt-4 text-center font-display text-[26px] font-extrabold leading-tight text-navy">Base Login</h1>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. oholei-torah" required /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            {error && <p className="rounded-xl bg-white/60 px-3 py-2 text-sm font-semibold text-red">{error}</p>}
            <Button type="submit" variant="navy" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>

          {import.meta.env.DEV && <DemoHint />}
        </div>
      </Card>
    </div>
  )
}
