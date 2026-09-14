import { useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { addShake, getSchool, getKidShakes } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, timeAgo, fileToScaledDataUrl } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { playShake, isMuted, setMuted } from '../lib/sound.js'
import { asset } from '../lib/asset.js'
import { Button, Card, Field, Input, Textarea, Spinner, SectionHeader, SchoolLogo, Pill, Avatar } from '../components/ui.jsx'
import SuccosReport from '../components/SuccosReport.jsx'
import Mascot from '../components/Mascot.jsx'

// Small-label style (Exo semibold caps, navy) — matches the Field label; condensed
// caps are reserved for buttons and nav.
const LABEL = 'text-[12px] font-semibold uppercase tracking-[0.08em] text-navy'

export default function KidDashboard() {
  const { kid, logoutKid } = useAuth()
  const fileRef = useRef(null)

  const { data: school } = useLiveData(() => (kid ? getSchool(kid.schoolId) : Promise.resolve(null)), [kid?.schoolId])
  const { data: myShakes, loading } = useLiveData(() => (kid ? getKidShakes(kid.id) : Promise.resolve([])), [kid?.id])

  const [count, setCount] = useState('')
  const [story, setStory] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [mascotMsg, setMascotMsg] = useState('')
  const [muted, setMutedState] = useState(isMuted())

  if (!kid) return <Navigate to="/login" replace />

  const myTotal = (myShakes || []).reduce((s, x) => s + x.count, 0)
  const myPhotoCount = (myShakes || []).reduce((n, s) => n + (s.photos?.length || (s.photo ? 1 : 0)), 0)

  async function onFiles(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    try {
      const urls = await Promise.all(files.map((f) => fileToScaledDataUrl(f)))
      setPhotos((p) => [...p, ...urls])
    } catch {
      setFlash('Could not read one of those images — try another.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    const n = Number(count)
    if (!n || n < 1) return
    if (n > 500) { setFlash('That’s a lot at once! Please split very large counts into separate entries.'); return }
    setBusy(true)
    const before = school
    await addShake({ kid, count: n, note: story, photos })
    setBusy(false)
    setCount(''); setStory(''); setPhotos([])
    setFlash(`🎉 ${n} shakes added! Yasher koach, ${kid.firstName}!`)
    setTimeout(() => setFlash(''), 5000)

    const updated = await getSchool(kid.schoolId)
    // Big celebration for reaching the goal or auto-launching the bonus round;
    // medium for crossing a 25/50/75% milestone; a small burst otherwise.
    const reachedGoal = updated && !before?.goalReached && updated.goalReached
    const launchedBonus = updated && !before?.bonusActive && updated.bonusActive
    const crossedMilestone = updated && [25, 50, 75].some((m) => (before?.percent ?? 0) < m && updated.percent >= m)
    celebrate(reachedGoal || launchedBonus ? 1.8 : crossedMilestone ? 1.2 : 0.5)
    playShake()
    setMascotMsg(
      reachedGoal ? 'GOAL REACHED! 🎉' : launchedBonus ? 'Bonus round unlocked! 🚀'
        : crossedMilestone ? 'You’re on fire! 🔥' : `Yasher koach, ${kid.firstName}!`,
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Soldier ID card: First / Last / Serial — sky card with the avatar and school logo */}
      <Card topColor={school?.color || 'var(--color-blue)'}>
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <Avatar name={`${kid.firstName} ${kid.lastName}`} src={kid.photo} size={60} />
          {school && <SchoolLogo school={school} size={44} className="hidden sm:block" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SectionHeader>Soldier</SectionHeader>
              {kid.rank && <Pill className="!bg-green !text-gold">🎖️ {kid.rank}</Pill>}
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
          </div>
          <Button variant="ghost" onClick={logoutKid}>Log out</Button>
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
        {/* Log form */}
        <Card className="p-6" topColor="var(--color-gold)">
          <div className="flex items-center justify-between">
            <SectionHeader>Log your shakes</SectionHeader>
            <button type="button" title={muted ? 'Sound off' : 'Sound on'}
              onClick={() => { const v = !muted; setMuted(v); setMutedState(v); if (!v) playShake() }}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-navy transition hover:bg-white">
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
          <p className="mt-1 mb-4 text-sm text-navy/80">Report how many people you helped shake Lulav — and snap a photo from the field!</p>
          <form onSubmit={submit} className="space-y-5">
            <Field label="Number of shakes">
              <Input type="number" min="1" max="500" value={count} onChange={(e) => { setCount(e.target.value); if (flash) setFlash('') }} placeholder="e.g. 12" required className="text-lg" />
            </Field>

            {/* Big, phone-friendly photo button */}
            <div>
              <span className={`mb-1.5 block ${LABEL}`}>Add photos</span>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={onFiles} className="hidden" id="photoInput" />
              <label htmlFor="photoInput"
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-track bg-white/70 px-4 py-6 text-center transition hover:border-green-mid hover:bg-white">
                <img src={asset('design/icon-camera.png')} alt="" className="h-12 w-auto" />
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-navy">Tap to take or upload photos</span>
                <span className="text-xs text-navy/70">Opens your camera on a phone · add as many as you like</span>
              </label>
              {photos.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={p} alt="" className="h-full w-full rounded-xl object-cover ring-2 ring-white" />
                      <button type="button" onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red text-[11px] font-bold text-white shadow">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Field label="Add a story (optional)" hint="Where were you? Who did you help?">
              <Textarea rows={3} value={story} onChange={(e) => setStory(e.target.value)} placeholder="e.g. Helped everyone at the nursing home on Kingston Ave. this morning!" />
            </Field>

            {flash && <p className="animate-pop rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-green">{flash}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? 'Reporting…' : 'Report my shakes 🌿'}
            </Button>
          </form>
        </Card>

        {/* History */}
        <Card className="p-6" topColor="var(--color-blue)">
          <SectionHeader>My missions</SectionHeader>
          {loading ? <Spinner /> : (myShakes || []).length === 0 ? (
            <p className="py-10 text-center text-sm text-navy/80">No missions logged yet. Your first one is waiting! 🌿</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {myShakes.map((s) => {
                const imgs = s.photos?.length ? s.photos : s.photo ? [s.photo] : []
                return (
                  <li key={s.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-0">
                    {imgs[0]
                      ? <img src={imgs[0]} alt="" className="h-12 w-12 flex-none rounded-xl object-cover ring-2 ring-white" />
                      : <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-white/70">🌿</span>}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-navy">
                        {fmt(s.count)} shakes {imgs.length > 1 && <span className="text-xs font-semibold text-navy/70">· {imgs.length} photos</span>}
                      </p>
                      {s.note && <p className="text-xs italic text-navy/80">“{s.note}”</p>}
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-navy/60">{new Date(s.createdAt).toLocaleString()} · {timeAgo(s.createdAt)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Succos report — the kid-facing version of the teacher checklist */}
      <div className="mt-6">
        <SuccosReport kid={kid} loggedShakes={myTotal} />
      </div>

      {mascotMsg && <Mascot message={mascotMsg} onDone={() => setMascotMsg('')} />}
    </div>
  )
}
