import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Card, Field, Input, Band } from '../components/ui.jsx'
import { asset } from '../lib/asset.js'

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
    const admin = await loginAdmin(username, password)
    setBusy(false)
    if (admin) navigate('/admin')
    else setError('Incorrect username or password.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {/* sky card on the mint page: shield, Exo heading, condensed pill submit */}
      <Card className="overflow-hidden">
        <Band />
        <div className="p-6 sm:p-8">
          <img src={asset('th-logo.svg')} alt="" className="mx-auto h-16 w-auto" />
          <p className="sh mt-4 text-center">School Admin</p>
          <h1 className="mt-1 text-center font-display text-[26px] font-extrabold leading-tight text-navy">Admin Login</h1>
          <p className="mt-1.5 text-center text-sm text-muted">For Tzivos Hashem HQ and school offices.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hq or your school" required /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
            {error && <p className="rounded-xl bg-white/60 px-3 py-2 text-sm font-semibold text-red">{error}</p>}
            <Button type="submit" variant="navy" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>

          <p className="mt-5 rounded-xl bg-white/55 px-3 py-2 text-center text-xs text-muted">
            <strong className="text-navy">Demo:</strong> HQ → <code>hq</code> / <code>lulav</code> · School → <code>bais-rivkah</code> / <code>lulav</code>
          </p>
        </div>
      </Card>
    </div>
  )
}
