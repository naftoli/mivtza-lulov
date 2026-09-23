import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Card, Field, Input, Band } from '../components/ui.jsx'
import { asset } from '../lib/asset.js'

const SERIAL_TIP = 'You can find your serial number on your account at mashpia.com.'

export default function KidLogin() {
  const { loginKid, kid } = useAuth()
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const kid = await loginKid(id, dob)
      if (kid) navigate('/me')
      // The API only lets in children registered for this school year, so this
      // covers an unregistered child as well as a mistyped serial or birthday.
      else setError('We could not find a registered soldier with that serial number and date of birth. Double-check and try again.')
    } catch (err) {
      // verifyKid() only swallows a wrong serial/DOB; everything else reaches
      // here. Without this the promise rejected unhandled, `busy` stayed true
      // and the button sat on "Checking…" forever — which is exactly what a
      // child hit after 12 tries, since the API rate-limits logins with a 429.
      setError(err?.message || 'We could not reach the base right now. Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  // Already signed in (e.g. via a school page's "I'm a Soldier" button): go
  // straight to the report instead of showing the login form again.
  if (kid) return <Navigate to="/me" replace />

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
      {/* Sky card on the mint page: shield, navy heading, navy field labels, gold pill submit */}
      <Card className="overflow-hidden">
        <Band />
        <div className="p-6 sm:p-8">
          <img src={asset('th-logo.png')} alt="" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 text-center font-display text-[26px] font-black uppercase leading-tight tracking-[-0.01em] text-navy">
            Soldier Login
          </h1>
          <p className="mt-1.5 text-center text-sm text-navy/80">Log in with your serial number and date of birth to record your shakes.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* Custom field (not <Field>) so the "where to find it" picture can sit
                under the input without nesting an <img> inside the field's <label>. */}
            <div>
              <label htmlFor="kid-serial" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-navy">
                Serial Number
              </label>
              <Input id="kid-serial" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 7750446" inputMode="numeric" required />
              {/* Where to find it: the soldier's own account card at mashpia.com,
                  serial circled — clearer to a child than a text hint. */}
              <figure className="mt-2">
                <img
                  src={asset('design/serial-location.jpg')}
                  alt="Your serial number appears on your account card at mashpia.com, under your rank."
                  draggable="false"
                  className="w-full select-none rounded-xl ring-1 ring-line"
                />
                <figcaption className="mt-1.5 text-[11px] font-medium leading-snug text-navy/70">{SERIAL_TIP}</figcaption>
              </figure>
            </div>
            <Field label="Date of Birth">
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </Field>
            {error && <p className="rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-red">{error}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Report for duty'}
            </Button>
          </form>

          {/* Dev-only hint (kid 100000 / 2015-01-01 is the seeded "Demo Soldier"); dropped from `vite build`. */}
          {import.meta.env.DEV && (
            <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-center text-xs text-navy/80">
              <strong>Demo:</strong> Serial <code>100000</code> · DOB <code>2015-01-01</code>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
