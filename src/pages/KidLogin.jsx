import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Card, Field, Input, Band } from '../components/ui.jsx'
import { asset } from '../lib/asset.js'

export default function KidLogin() {
  const { loginKid } = useAuth()
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const kid = await loginKid(id, dob)
    setBusy(false)
    if (kid) navigate('/me')
    else setError('We could not find a soldier with that serial number and date of birth. Double-check and try again.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
      {/* Sky card on the mint page: shield, navy heading, navy field labels, gold pill submit */}
      <Card className="overflow-hidden">
        <Band />
        <div className="p-6 sm:p-8">
          <img src={asset('th-logo.svg')} alt="" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 text-center font-display text-[26px] font-black uppercase leading-tight tracking-[-0.01em] text-navy">
            Soldier Login
          </h1>
          <p className="mt-1.5 text-center text-sm text-navy/80">Log in with your serial number and date of birth to record your shakes.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Serial Number">
              <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 10023" inputMode="numeric" required />
            </Field>
            <Field label="Date of Birth">
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </Field>
            {error && <p className="rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-red">{error}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Report for duty 🎖️'}
            </Button>
          </form>

          <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-center text-xs text-navy/80">
            <strong>Demo:</strong> Serial <code>100000</code> · DOB <code>2015-01-01</code>
          </p>
        </div>
      </Card>
    </div>
  )
}
