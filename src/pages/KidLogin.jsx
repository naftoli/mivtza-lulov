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
  const [tipOpen, setTipOpen] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const kid = await loginKid(id, dob)
      if (kid) navigate('/me')
      else setError('We could not find a soldier with that serial number and date of birth. Double-check and try again.')
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
          <img src={asset('th-logo.svg')} alt="" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 text-center font-display text-[26px] font-black uppercase leading-tight tracking-[-0.01em] text-navy">
            Soldier Login
          </h1>
          <p className="mt-1.5 text-center text-sm text-navy/80">Log in with your serial number and date of birth to record your shakes.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* Serial number: a custom field (not <Field>) so the info button isn't
                nested inside the field's <label> — a labelable <button> there would
                hijack the label's control and steal focus from the input. The <label
                htmlFor> wraps only the text; the button sits beside it. Native title =
                hover tooltip; click/keyboard toggles the styled inline note for touch.
                The note is in normal flow so it never overflows / gets clipped at 375px. */}
            <div>
              <div className="mb-1.5 flex flex-col gap-1">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-navy">
                  <label htmlFor="kid-serial">Serial Number</label>
                  <button
                    type="button"
                    aria-label={SERIAL_TIP}
                    title={SERIAL_TIP}
                    aria-expanded={tipOpen}
                    onClick={() => setTipOpen((o) => !o)}
                    onBlur={() => setTipOpen(false)}
                    className="grid h-4 w-4 flex-none place-items-center rounded-full text-navy/70 transition hover:text-navy"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11.5v4.5M12 7.75h.01" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
                {tipOpen && (
                  <span role="note" className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px] font-medium normal-case leading-snug tracking-normal text-navy/80">
                    {SERIAL_TIP}
                  </span>
                )}
              </div>
              <Input id="kid-serial" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. 7750446" inputMode="numeric" required />
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
