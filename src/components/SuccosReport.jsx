import { useEffect, useRef, useState } from 'react'
import { getReport, saveReport } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fileToScaledDataUrl } from '../lib/format.js'
import { Card, Field, Input, Textarea, Button, SectionHeader, Pill, Spinner } from './ui.jsx'

// The six days Lulav is taken (the 5th day of Succos is Shabbos — skipped),
// matching the teacher checklist.
const DAYS = [
  { n: 1, label: '1st' },
  { n: 2, label: '2nd' },
  { n: 3, label: '3rd' },
  { n: 4, label: '4th' },
  { n: 6, label: '6th' },
  { n: 7, label: '7th' },
]

const DEFAULTS = { days: [], minutes: '', peopleWithFriends: '', peoplePersonal: '', story: '', photos: [] }

export default function SuccosReport({ kid, loggedShakes = 0 }) {
  const fileRef = useRef(null)
  const { data: report, loading } = useLiveData(() => getReport(kid.id), [kid.id])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState('')

  // Prefill once the saved report has loaded.
  useEffect(() => {
    if (!loading && form === null) {
      const base = report ? { ...DEFAULTS, ...report, days: report.days || [] } : { ...DEFAULTS }
      // Link the two forms: default "people personally" to the shakes already logged.
      if (base.peoplePersonal === '' || base.peoplePersonal == null) base.peoplePersonal = loggedShakes || ''
      setForm(base)
      if (report?.updatedAt) setSavedAt(report.updatedAt)
    }
  }, [loading, report, form])

  if (!form) return <Card className="p-6"><Spinner label="Loading your report…" /></Card>

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleDay = (n) =>
    setForm((f) => ({ ...f, days: f.days.includes(n) ? f.days.filter((d) => d !== n) : [...f.days, n].sort((a, b) => a - b) }))

  async function onFiles(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    try {
      const urls = await Promise.all(files.map((fl) => fileToScaledDataUrl(fl)))
      set('photos', [...form.photos, ...urls])
      setError('')
    } catch {
      setError('Could not read one of those images — try another.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await saveReport(kid.id, {
        schoolId: kid.schoolId,
        days: form.days,
        minutes: form.minutes === '' ? null : Number(form.minutes),
        peopleWithFriends: form.peopleWithFriends === '' ? null : Number(form.peopleWithFriends),
        peoplePersonal: form.peoplePersonal === '' ? null : Number(form.peoplePersonal),
        story: form.story.trim(),
        photos: form.photos,
      })
      setSavedAt(saved?.updatedAt || new Date().toISOString())
    } catch (err) {
      // Nothing was saved — keep the form so the kid can retry.
      setError(err?.message || 'Could not save your report — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6" topColor="var(--color-cyan)">
      <div className="mb-1 flex items-center justify-between gap-2">
        <SectionHeader>My Succos Report</SectionHeader>
        {savedAt && <Pill className="!bg-green/15 !text-green">✓ Saved {new Date(savedAt).toLocaleDateString()}</Pill>}
      </div>
      <p className="mb-5 text-sm text-muted">
        Fill in your own Mivtza Lulav for Succos — you can update it any time.
      </p>

      <form onSubmit={save} className="space-y-6">
        {/* Days */}
        <div>
          <span className="mb-2 block font-cond text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Which days did you go on Mivtza Lulav?
          </span>
          <p className="mb-2 text-xs text-muted/80">I helped other Yidden shake Lulav &amp; Esrog on the…</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = form.days.includes(d.n)
              return (
                <button type="button" key={d.n} onClick={() => toggleDay(d.n)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${on ? 'bg-navy text-white shadow-sm' : 'bg-paper text-navy ring-1 ring-line hover:ring-blue'}`}>
                  {on ? '✓ ' : ''}{d.label} day
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted/70">(The 5th day of Succos is Shabbos — no Lulav.)</p>
        </div>

        {/* Numbers */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minutes on Mivtza Lulav">
            <Input type="number" min="0" value={form.minutes} onChange={(e) => set('minutes', e.target.value)} placeholder="e.g. 90" />
          </Field>
          <Field label="People shaken — with friends" hint="Total together with your friend(s)">
            <Input type="number" min="0" value={form.peopleWithFriends} onChange={(e) => set('peopleWithFriends', e.target.value)} placeholder="e.g. 60" />
          </Field>
          <Field label="People shaken — personally" hint={loggedShakes ? `Auto-filled from your ${loggedShakes} logged shakes — adjust if needed` : 'Your own share (if shared, divide the total)'}>
            <Input type="number" min="0" value={form.peoplePersonal} onChange={(e) => set('peoplePersonal', e.target.value)} placeholder="e.g. 30" />
          </Field>
        </div>

        {/* Photos */}
        <div>
          <span className="mb-1.5 block font-cond text-xs font-semibold uppercase tracking-[0.1em] text-muted">Photos from the field</span>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" id="reportPhotos" />
          <label htmlFor="reportPhotos"
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-paper py-5 text-center transition hover:border-blue hover:bg-blue/5">
            <span className="text-2xl">📷</span>
            <span className="font-cond text-sm font-semibold uppercase tracking-wide text-navy">Tap to add photos</span>
          </label>
          {form.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {form.photos.map((p, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={p} alt="" className="h-full w-full rounded-lg object-cover ring-1 ring-line" />
                  <button type="button" onClick={() => set('photos', form.photos.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red text-[11px] font-bold text-white shadow">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Story */}
        <Field label="My story (optional)" hint="Anything special that happened on your mivtzoim?">
          <Textarea rows={3} value={form.story} onChange={(e) => set('story', e.target.value)} placeholder="e.g. We went to the hospital and everyone was so happy to shake Lulav!" />
        </Field>

        {error && <p className="animate-pop rounded-lg bg-red/8 px-3 py-2 text-sm font-semibold text-red">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="gold" disabled={busy}>{busy ? 'Saving…' : 'Save my report'}</Button>
          {savedAt && !busy && !error && <span className="font-cond text-sm font-semibold uppercase text-green">✓ Saved</span>}
        </div>
      </form>
    </Card>
  )
}
