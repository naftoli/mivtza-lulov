import { useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { addShake, getSchool, getKidShakes, getKidDayReport } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, hebrewDate, fileToScaledDataUrl } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { playShake, isMuted, setMuted } from '../lib/sound.js'
import { asset } from '../lib/asset.js'
import { LULAV_DAYS, SHABBOS_DAY, ordinal } from '../lib/succos.js'
import { Button, Card, Field, Input, Textarea, Spinner, SectionHeader, SchoolLogo, Pill, Avatar, ErrorNote, LulavIcon } from '../components/ui.jsx'
import Mascot from '../components/Mascot.jsx'

// Small-label style (Exo semibold caps, navy) — matches the Field label; condensed
// caps are reserved for buttons and nav.
const LABEL = 'text-[12px] font-semibold uppercase tracking-[0.08em] text-navy'
// Flash notices: green on white for a success; the muted race-red tint (as on the
// admin moderation card) when a save or an image failed.
const SUCCESS_NOTICE = 'animate-pop rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-green'
const ERROR_NOTICE = 'animate-pop rounded-xl bg-race-red/12 px-3 py-2 text-sm font-semibold text-red ring-1 ring-race-red/45'

export default function KidDashboard() {
  const { kid, logoutKid } = useAuth()
  const fileRef = useRef(null)
  const dayRequestRef = useRef(0)

  const { data: school } = useLiveData(() => (kid ? getSchool(kid.schoolId) : Promise.resolve(null)), [kid?.schoolId])
  const { data: myShakes, loading, error: shakesError, reload: reloadShakes } = useLiveData(() => (kid ? getKidShakes(kid.id) : Promise.resolve([])), [kid?.id])

  const [day, setDay] = useState(null) // which Sukkos day this entry is for
  const [count, setCount] = useState('')
  const [minutes, setMinutes] = useState('')
  const [story, setStory] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [loadingDay, setLoadingDay] = useState(false)
  const [flash, setFlash] = useState('')
  const [flashError, setFlashError] = useState(false) // true when `flash` reports a failure
  const [mascotMsg, setMascotMsg] = useState('')
  const [muted, setMutedState] = useState(isMuted())

  if (!kid) return <Navigate to="/login" replace />

  const myTotal = (myShakes || []).reduce((s, x) => s + x.count, 0)
  const myPhotoCount = (myShakes || []).reduce((n, s) => n + (s.photos?.length || (s.photo ? 1 : 0)), 0)

  const notify = (text, isError = false) => { setFlash(text); setFlashError(isError) }

  async function selectDay(selectedDay) {
    const request = ++dayRequestRef.current
    setDay(selectedDay)
    setLoadingDay(true)
    if (flash) setFlash('')
    try {
      const report = await getKidDayReport(kid.id, selectedDay)
      if (request !== dayRequestRef.current) return
      setCount(report?.count ? String(report.count) : '')
      setMinutes(report?.minutes ? String(report.minutes) : '')
      setStory(report?.note || '')
      setPhotos(report?.photos || [])
    } catch (error) {
      if (request !== dayRequestRef.current) return
      notify(error?.message || 'Could not load that day’s report.', true)
    } finally {
      if (request === dayRequestRef.current) setLoadingDay(false)
    }
  }

  async function onFiles(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    try {
      const urls = await Promise.all(files.map((f) => fileToScaledDataUrl(f)))
      setPhotos((p) => [...p, ...urls])
    } catch {
      notify('Could not read one of those images — try another.', true)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    if (!day) return
    const n = Number(count)
    if (!n || n < 1) return
    if (n > 500) { notify('That’s a lot at once! Please split very large counts into separate entries.', true); return }
    setBusy(true)
    const before = school
    try {
      await addShake({ kid, day, count: n, minutes: Number(minutes) || 0, note: story, photos })
    } catch (err) {
      // Nothing was saved — keep the form (and photos) so the kid can retry.
      notify(err?.message || 'Could not save your shakes — please try again.', true)
      return
    } finally {
      setBusy(false)
    }
    setDay(null); setCount(''); setMinutes(''); setStory(''); setPhotos([])
    notify(`🎉 ${n} shakes added! Yasher koach, ${kid.firstName}!`)
    setTimeout(() => setFlash(''), 5000)

    const updated = await getSchool(kid.schoolId).catch(() => null)
    // Big celebration for reaching the goal or pushing the school into its next
    // bonus round; medium for crossing a 25/50/75% milestone; a small burst otherwise.
    const reachedGoal = updated && !before?.goalReached && updated.goalReached
    const launchedBonus = updated && before?.goalReached && (updated.bonusLevel || 0) > (before.bonusLevel || 0)
    const crossedMilestone = updated && [25, 50, 75].some((m) => (before?.percent ?? 0) < m && updated.percent >= m)
    celebrate(reachedGoal || launchedBonus ? 1.8 : crossedMilestone ? 1.2 : 0.5)
    playShake()
    setMascotMsg(
      reachedGoal ? 'GOAL REACHED! 🎉' : launchedBonus ? `Bonus round ${updated.bonusLevel} unlocked! 🚀`
        : crossedMilestone ? 'You’re on fire! 🔥' : `Yasher koach, ${kid.firstName}!`,
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Soldier ID card: First / Last / Serial — sky card with the avatar and school logo */}
      <Card>
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <Avatar name={`${kid.firstName} ${kid.lastName}`} src={kid.photo} size={60} />
          {school && <SchoolLogo school={school} size={44} className="hidden sm:grid" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SectionHeader>Soldier</SectionHeader>
              {/* The army rank logo, as Recent Shakes and the leaderboard show it;
                  the medal emoji only stands in when there is no image (demo). */}
              {kid.rankImageUrl && <img src={kid.rankImageUrl} alt="" className="h-10 w-10 object-contain" />}
              {kid.rank && <Pill className="!bg-green !text-gold">{!kid.rankImageUrl && '🎖️ '}{kid.rank}</Pill>}
            </div>
            <h1 className="font-display text-2xl font-black leading-tight text-navy sm:text-[28px]">
              {kid.firstName} {kid.lastName}
            </h1>
            {kid.hebFirst && <p className="font-heb text-lg leading-tight text-navy/80">{kid.hebFirst} {kid.hebLast}</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-sm text-navy/80">
              <span><span className={LABEL}>Serial No.</span> <strong className="font-bold text-navy">{kid.id}</strong></span>
              {kid.grade && <span><span className={LABEL}>Platoon</span> <strong className="font-bold text-navy">{kid.grade}</strong></span>}
              {school && <Link to={`/s/${school.id}`} className="font-semibold text-green hover:underline">{school.name} · view campaign →</Link>}
            </div>
            {/* phones: Log out sits under the details instead of squeezing the name */}
            <Button variant="ghost" onClick={logoutKid} className="-ml-3 mt-2 px-3 py-1.5 sm:hidden">Log out</Button>
          </div>
          <Button variant="ghost" onClick={logoutKid} className="hidden sm:inline-flex">Log out</Button>
        </div>
      </Card>

      {/* stats — 3D icon at left, Exo Black number, Exo SemiBold caps label */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          { icon: asset('design/icon-soldier-hat.png'), v: fmt(myTotal), l: 'My Shakes' },
          { icon: asset('design/icon-camera.png'), v: fmt(myPhotoCount), l: 'My Photos' },
          { icon: asset('design/icon-school.png'), v: school ? `${school.percent}%` : '—', l: 'School Goal' },
        ].map((s) => (
          <Card key={s.l} className="flex items-center gap-4 p-4 sm:p-5">
            <img src={s.icon} alt="" className="h-14 w-auto shrink-0 sm:h-16" />
            <div className="min-w-0">
              <div className="font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[34px]">{s.v}</div>
              <div className="mt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-navy">{s.l}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Log form — DAY FIRST: pick a day, then the rest of the form appears */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <SectionHeader>Log your shakes</SectionHeader>
            <button type="button" title={muted ? 'Sound off' : 'Sound on'} aria-label="Sound effects" aria-pressed={!muted}
              onClick={() => { const v = !muted; setMuted(v); setMutedState(v); if (!v) playShake() }}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-navy transition hover:bg-white">
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
          <p className="mt-1 mb-4 text-sm text-navy/80">Report how many people you helped shake Lulav — and snap a photo from the field!</p>
          <form onSubmit={submit} className="space-y-5">
            {/* Step 1 — which day of Succos */}
            <div>
              <span className={`mb-2 block ${LABEL}`}>Which day are you reporting?</span>
              <div className="flex flex-wrap gap-2">
                {LULAV_DAYS.map((n) => {
                  const on = day === n
                  return (
                    // Single-select day pills: navy when picked; the deeper sky (track) when not.
                    <button type="button" key={n} onClick={() => selectDay(n)} aria-pressed={on}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${on ? 'bg-navy text-white shadow-sm' : 'bg-track text-navy ring-1 ring-transparent hover:ring-green-mid'}`}>
                      {on ? '✓ ' : ''}{ordinal(n)} day
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-navy/70">(The {ordinal(SHABBOS_DAY)} day of Succos is Shabbos — no Lulav.)</p>
            </div>

            {/* Steps 2+ — only after a day is chosen */}
            {day && !loadingDay && (
              <>
                <Field label="Number of shakes" hint="If you went on Mivtzoyim with another Chayol, divide the total between yourselves">
                  <Input type="number" min="1" max="500" value={count} onChange={(e) => { setCount(e.target.value); if (flash) setFlash('') }} placeholder="e.g. 12" required className="text-lg" />
                </Field>

                <Field label="Minutes on Mivtzoim">
                  <Input type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="e.g. 90" />
                </Field>

                {/* Big, phone-friendly photo button */}
                <div>
                  <span className={`mb-1.5 block ${LABEL}`}>Add photos</span>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" id="photoInput" />
                  <label htmlFor="photoInput"
                    className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-track bg-white/70 px-4 py-6 text-center transition hover:border-green-mid hover:bg-white">
                    <img src={asset('design/icon-camera.png')} alt="" className="h-12 w-auto" />
                    <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-navy">Tap to take or upload photos</span>
                    <span className="text-xs text-navy/70">Take a new photo or pick from your gallery · add as many as you like</span>
                  </label>
                  {photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {photos.map((p, i) => (
                        <div key={i} className="relative aspect-square">
                          <img src={p} alt="" className="h-full w-full rounded-xl object-cover ring-2 ring-white" />
                          <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red text-[11px] font-bold text-white shadow">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Field label="Add a story (optional)" hint="Where were you? Who did you help?">
                  <Textarea rows={3} value={story} onChange={(e) => setStory(e.target.value)} placeholder="e.g. Helped everyone at the nursing home on Kingston Ave. this morning!" />
                </Field>

                {flash && <p className={flashError ? ERROR_NOTICE : SUCCESS_NOTICE}>{flash}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                  {busy ? 'Reporting…' : <>Report my shakes <LulavIcon className="-my-1.5 h-7" /></>}
                </Button>
              </>
            )}

            {loadingDay && <Spinner />}
            {!day && flash && <p className={flashError ? ERROR_NOTICE : SUCCESS_NOTICE}>{flash}</p>}
          </form>
        </Card>

        {/* History */}
        <Card className="p-6">
          <SectionHeader>My Mivtza Lulov Report</SectionHeader>
          {shakesError && !myShakes ? <ErrorNote error={shakesError} onRetry={reloadShakes} what="your report" />
            : loading ? <Spinner /> : (myShakes || []).length === 0 ? (
            <p className="py-10 text-center text-sm text-navy/80">No missions logged yet. Your first one is waiting!{' '}<LulavIcon className="h-[1.9em] align-[-0.55em]" /></p>
          ) : (
            <ul className="mt-3 space-y-3">
              {myShakes.map((s) => {
                const imgs = s.photos?.length ? s.photos : s.photo ? [s.photo] : []
                return (
                  <li key={s.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0">
                    {imgs[0]
                      ? <img src={imgs[0]} alt="" className="h-12 w-12 flex-none rounded-xl object-cover ring-2 ring-white" />
                      : <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-white/70"><LulavIcon className="h-9" /></span>}
                    <div className="min-w-0 flex-1">
                      {s.day > 0 && (
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-green">{ordinal(s.day)} day of Sukkos</p>
                      )}
                      <p className="text-[15px] font-bold text-navy">
                        {fmt(s.count)} Shakes <span className="text-navy/40">|</span> {fmt(s.minutes || 0)} Minutes on Mivtzoim
                      </p>
                      {s.note && <p className="text-xs italic text-navy/80">“{s.note}”</p>}
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/60">{hebrewDate(s.createdAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {mascotMsg && <Mascot message={mascotMsg} onDone={() => setMascotMsg('')} />}
    </div>
  )
}
