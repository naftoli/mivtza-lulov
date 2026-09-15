import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getSchools, getSchool, getShakes, getKidsForSchool,
  updateSchool, setShakeHidden, addKid, resetDemoData, getReportsForSchool,
  getPendingPhotos, approvePhotos, approveAllPhotos, rejectPhotos,
  getSettings, setPerKidGoal, setSchoolGoal,
} from '../services/api.js'

// Fixed campaign end (Isru Chag), shown read-only — e.g. "Mon, Oct 5".
const prettyDate = (iso) =>
  new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
import ReportGrid from '../components/ReportGrid.jsx'
import { PhotoLightbox } from '../components/PhotoWall.jsx'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, timeAgo } from '../lib/format.js'
import { asset } from '../lib/asset.js'
import { Button, Card, Field, Input, Spinner, Pill, SectionHeader, SchoolLogo } from '../components/ui.jsx'

// Shared bits of the admin skin (sky cards on mint, navy / green-deep type).
const label = 'text-[11px] font-semibold uppercase tracking-[0.1em] text-navy'   // small Exo label
const tile = 'rounded-2xl bg-white/55'                                          // soft inset panel on a sky card
const smallBtn = '!px-4 !py-2 !text-[15px]'                                     // compact pill inside cards
// muted red pill (#eb635d = race-red token) for reject / remove — white text
const dangerBtn = `${smallBtn} !bg-race-red !text-white`
// race bar palette in rank order (matches the Home race card)
const RACE = ['var(--color-race-green)', 'var(--color-race-yellow)', 'var(--color-race-blue)', 'var(--color-race-red)', 'var(--color-race-teal)']
const MEDALS = ['medal-gold.png', 'medal-silver.png', 'medal-bronze.png']

function Section({ title, children, right, topColor }) {
  return (
    <Card className="p-6" topColor={topColor}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeader>{title}</SectionHeader>
        {right}
      </div>
      {children}
    </Card>
  )
}

export default function AdminDashboard() {
  const { admin, logoutAdmin } = useAuth()
  const { data: schools } = useLiveData(() => getSchools(), [])
  const [selectedId, setSelectedId] = useState(null)
  const selectedSchool = schools?.find((s) => s.id === selectedId)

  useEffect(() => {
    if (admin?.role === 'school') setSelectedId(admin.schoolId)
    else if (admin?.role === 'hq' && schools?.length && !selectedId) setSelectedId(schools[0].id)
  }, [admin, schools, selectedId])

  if (!admin) return <Navigate to="/admin/login" replace />

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="sh">{admin.role === 'hq' ? 'HQ Command Center' : 'School Admin'}</p>
          <h1 className="mt-0.5 font-display text-3xl font-black leading-tight text-navy">{admin.name}</h1>
        </div>
        <div className="flex gap-2">
          {admin.role === 'hq' && (
            <Button variant="outline" onClick={() => { if (confirm('Reset ALL demo data back to the sample seed?')) resetDemoData() }}>Reset demo data</Button>
          )}
          <Button variant="ghost" onClick={logoutAdmin}>Log out</Button>
        </div>
      </div>

      {admin.role === 'hq' && schools && (
        <div className="mt-6">
          <Section title="All Schools — the Race" topColor="var(--color-gold)">
            <div className="space-y-2">
              {[...schools].sort((a, b) => b.percent - a.percent).map((s, i) => (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left transition hover:bg-white/45 sm:gap-3 ${selectedId === s.id ? 'bg-white/55 ring-1 ring-green-mid/50' : ''}`}>
                  <span className="grid w-5 flex-none place-items-center sm:w-8">
                    {MEDALS[i]
                      ? <img src={asset(`design/${MEDALS[i]}`)} alt={`Rank ${i + 1}`} className="h-5 w-5 object-contain sm:h-8 sm:w-8" />
                      : <span className="font-display text-base font-bold italic text-blue-accent sm:text-lg">{i + 1}</span>}
                  </span>
                  <SchoolLogo school={s} size={32} />
                  <span className="w-24 flex-none truncate font-semibold text-navy sm:w-36">{s.name}</span>
                  <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-track">
                    <span className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.max(s.percent, 3)}%`, background: `linear-gradient(90deg, rgba(255,255,255,.22), rgba(0,28,76,.16)), ${RACE[i % RACE.length]}` }} />
                  </span>
                  <span className="w-20 flex-none text-right text-[12px] font-bold tabular-nums text-green sm:w-28 sm:text-[13px]">{fmt(s.total)} · {s.percent}%</span>
                </button>
              ))}
            </div>
          </Section>
          <div className="mt-6"><GlobalGoalSettings /></div>
        </div>
      )}

      {selectedId && (
        <div className="mt-6">
          {admin.role === 'hq' && (
            <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
              <div className="flex items-center gap-3">
                {selectedSchool && <SchoolLogo school={selectedSchool} size={40} />}
                <div>
                  <p className="sh text-[11px]">Managing as HQ</p>
                  <p className="font-display text-lg font-bold text-navy">{selectedSchool?.name}</p>
                </div>
              </div>
              <label className="flex max-w-full items-center gap-2">
                <span className={`${label} flex-none whitespace-nowrap`}>Switch school</span>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-blue focus:ring-2 focus:ring-blue/25">
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </Card>
          )}
          <SchoolAdmin key={selectedId} schoolId={selectedId} isHQ={admin.role === 'hq'} />
        </div>
      )}
    </div>
  )
}

function SchoolAdmin({ schoolId, isHQ }) {
  const { data: school } = useLiveData(() => getSchool(schoolId), [schoolId])
  const { data: shakes } = useLiveData(() => getShakes(schoolId, { includeHidden: true }), [schoolId])
  const { data: kids } = useLiveData(() => getKidsForSchool(schoolId), [schoolId])
  const { data: reports } = useLiveData(() => getReportsForSchool(schoolId), [schoolId])
  const { data: pending } = useLiveData(() => getPendingPhotos(schoolId), [schoolId])

  if (!school) return <div className="mt-6"><Spinner /></div>

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CampaignSettings school={school} isHQ={isHQ} />
        <Roster schoolId={schoolId} kids={kids || []} />
      </div>
      <PhotoApprovals schoolId={schoolId} shakes={pending || []} />
      <ReportGrid kids={kids || []} reports={reports || []} />
      <Moderation shakes={shakes || []} />
    </div>
  )
}

// HQ-only: the automatic goal per soldier, applied to every school, class and the
// nationwide goal at once. (Schools never see this.)
function GlobalGoalSettings() {
  const { data: settings } = useLiveData(() => getSettings(), [])
  const [val, setVal] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (settings) setVal(String(settings.perKidGoal)) }, [settings?.perKidGoal])

  async function save(e) {
    e.preventDefault()
    if (Number(val) >= 1) {
      await setPerKidGoal(val)
      setSaved(true); setTimeout(() => setSaved(false), 1600)
    }
  }

  return (
    <Section title="Automatic Goal" topColor="var(--color-green)">
      <p className="text-sm text-muted">
        Every automatic goal is this many shakes per soldier — each school, every class, and the nationwide goal.
        Change it and they all update at once. (Set a different number for one school under that school below.)
      </p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Shakes per soldier">
          <Input type="number" min="1" value={val} onChange={(e) => setVal(e.target.value)} className="w-28" />
        </Field>
        <Button type="submit" variant="navy">Save</Button>
        {saved && <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-green">✓ Saved</span>}
      </form>
    </Section>
  )
}

function CampaignSettings({ school, isHQ }) {
  const autoGoal = school.kidCount * school.perKidGoal
  const [motto, setMotto] = useState(school.motto)
  // Blank = automatic; a number = an HQ custom goal for this school.
  const [goalVal, setGoalVal] = useState(school.goalCustom ? String(school.goal) : '')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setMotto(school.motto)
    setGoalVal(school.goalCustom ? String(school.goal) : '')
  }, [school.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault()
    await updateSchool(school.id, { motto })
    if (isHQ) await setSchoolGoal(school.id, goalVal) // '' clears back to automatic
    setSaved(true); setTimeout(() => setSaved(false), 1600)
  }

  return (
    <Section title="Campaign Settings" topColor={school.color} right={<Pill>{school.percent}% of goal</Pill>}>
      {/* Goal: automatic (soldiers × per-kid) unless HQ sets a custom number. Schools can't. */}
      {isHQ ? (
        <div className={`${tile} p-4`}>
          <p className={label}>Goal</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Input type="number" min="1" value={goalVal} onChange={(e) => setGoalVal(e.target.value)}
              placeholder={`${fmt(autoGoal)} (auto)`} className="w-40" />
            <span className="text-sm font-semibold text-muted">shakes</span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            Leave blank for the automatic goal — {fmt(school.kidCount)} soldiers × {school.perKidGoal} = {fmt(autoGoal)}.
            {school.goalCustom && ' This school is on a custom goal right now.'}
          </p>
        </div>
      ) : (
        <div className={`${tile} p-4`}>
          <p className={label}>Goal {school.goalCustom ? '(set by HQ)' : '(automatic)'}</p>
          <p className="font-display text-3xl font-black text-navy">{fmt(school.goal)} <span className="text-lg font-semibold text-muted">shakes</span></p>
          <p className="mt-1 text-sm text-muted">
            {school.goalCustom
              ? 'Set by HQ for this school.'
              : `${fmt(school.kidCount)} soldiers × ${school.perKidGoal} shakes each. It updates as soldiers are added.`}
          </p>
        </div>
      )}

      <form onSubmit={save} className="mt-4 space-y-4">
        <Field label="Motto"><Input value={motto} onChange={(e) => setMotto(e.target.value)} /></Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="navy">Save</Button>
          {saved && <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-green">✓ Saved</span>}
        </div>
      </form>

      {/* End date is fixed to Isru Chag — not editable by anyone. */}
      <div className={`${tile} mt-4 p-4`}>
        <p className={label}>Campaign ends</p>
        <p className="mt-0.5 font-semibold text-navy">{prettyDate(school.endDate)} · Isru Chag Sukkos</p>
        <p className="mt-1 text-sm text-muted">Set by the calendar — the same for every school.</p>
      </div>

      <div className={`${tile} mt-4 p-4`}>
        <p className="sh !text-gold-dark">⭐ Bonus Rounds (automatic)</p>
        <p className="mt-1 text-sm text-navy">
          {school.bonusActive
            ? `Round ${school.bonusLevel} — target ${fmt(school.activeGoal)} shakes (+1 per soldier each round).`
            : `Once ${fmt(school.goal)} is reached, a bonus round starts on its own, adding ${fmt(school.kidCount)} (1 per soldier) each time.`}
        </p>
      </div>
    </Section>
  )
}

function Roster({ schoolId, kids }) {
  const [form, setForm] = useState({ id: '', dob: '', firstName: '', lastName: '', grade: '' })
  const [error, setError] = useState('')

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      await addKid(schoolId, form)
      setForm({ id: '', dob: '', firstName: '', lastName: '', grade: '' })
    } catch (err) { setError(err.message) }
  }

  const byGrade = useMemo(() => {
    const g = {}
    kids.forEach((k) => { (g[k.grade || '—'] ??= []).push(k) })
    return g
  }, [kids])

  return (
    <Section title="Soldier Roster" topColor="var(--color-blue)" right={<Pill>{kids.length} soldiers</Pill>}>
      <form onSubmit={add} className="grid grid-cols-2 gap-3">
        <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></Field>
        <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></Field>
        <Field label="Serial number"><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required /></Field>
        <Field label="Date of birth"><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} required /></Field>
        <Field label="Grade / class"><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. 5" /></Field>
        <div className="col-span-2">
          {error && <p className="mb-2 rounded-xl bg-white/60 px-3 py-2 text-sm font-semibold text-red">{error}</p>}
          <Button type="submit" variant="outline" className="w-full">+ Add soldier</Button>
        </div>
      </form>

      <div className="mt-4 max-h-52 space-y-3 overflow-auto pr-1">
        {Object.keys(byGrade).sort().map((grade) => (
          <div key={grade}>
            <p className={`${label} mb-1`}>Grade {grade}</p>
            <ul className="space-y-1">
              {byGrade[grade].map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/55 px-3 py-1.5 text-sm">
                  <span className="truncate font-semibold text-navy">{k.firstName} {k.lastName}</span>
                  <span className="flex flex-none items-center gap-2">
                    {k.rank && <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gold-dark">{k.rank}</span>}
                    <span className="text-[11px] font-semibold tabular-nums text-muted">#{k.id}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

function PhotoApprovals({ schoolId, shakes }) {
  const [active, setActive] = useState(null) // photo open in the lightbox
  const [busy, setBusy] = useState(false)

  async function approveAll() {
    if (!confirm(`Approve all ${shakes.length} pending entries? Every photo in them will show on the public page.`)) return
    setBusy(true)
    try { await approveAllPhotos(schoolId) } finally { setBusy(false) }
  }

  return (
    <Section title="Photo Approvals" topColor="var(--color-gold)"
      right={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Pill>{shakes.length} pending</Pill>
          {shakes.length > 0 && (
            <Button variant="navy" className={smallBtn} disabled={busy} onClick={approveAll}>
              ✓ Approve all ({shakes.length})
            </Button>
          )}
        </div>
      }>
      {shakes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing to review — all photos approved. ✓</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">Photos are hidden from the public page until you approve them. Approving an entry publishes every photo in it — tap a thumbnail to see it full size.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {shakes.map((s) => {
              const imgs = s.photos?.length ? s.photos : s.photo ? [s.photo] : []
              return (
                <div key={s.id} className={`${tile} p-3`}>
                  {/* every photo in the entry — the admin must be able to see what Approve will publish */}
                  <div className="flex flex-wrap gap-2">
                    {imgs.map((img, i) => (
                      <button key={i} type="button" onClick={() => setActive({ ...s, photo: img })}
                        aria-label={`View photo ${i + 1} of ${imgs.length} full size`}
                        className="h-16 w-16 flex-none overflow-hidden rounded-xl ring-2 ring-white transition hover:ring-green-mid focus-visible:outline-none focus-visible:ring-green-mid">
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 min-w-0">
                    <p className="text-sm font-semibold text-navy">{s.kidName} · {fmt(s.count)} shakes {imgs.length > 1 && <span className="text-xs font-normal text-muted">· {imgs.length} photos</span>}</p>
                    {s.note && <p className="truncate text-xs italic text-muted">“{s.note}”</p>}
                    <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted/80">{timeAgo(s.createdAt)}</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="navy" className={smallBtn} onClick={() => approvePhotos(s.id)}>✓ Approve{imgs.length > 1 ? ` all ${imgs.length}` : ''}</Button>
                      <Button variant="red" className={dangerBtn} onClick={() => rejectPhotos(s.id)}>Reject</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      <PhotoLightbox photo={active} onClose={() => setActive(null)} />
    </Section>
  )
}

function Moderation({ shakes }) {
  return (
    <Section title="Photo & Entry Moderation" topColor="var(--color-red)"
      right={<span className="text-xs text-muted">Hidden entries don’t count toward the goal or show publicly</span>}>
      {shakes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No entries yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shakes.map((s) => {
            const imgs = s.photos?.length ? s.photos : s.photo ? [s.photo] : []
            return (
              <div key={s.id} className={`flex items-start gap-3 rounded-2xl p-3 ${s.hidden ? 'bg-race-red/12 ring-1 ring-race-red/45' : 'bg-white/55'}`}>
                {imgs[0]
                  ? <img src={imgs[0]} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />
                  : <span className="grid h-14 w-14 flex-none place-items-center rounded-xl bg-track">🌿</span>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{s.kidName} · {fmt(s.count)} shakes {imgs.length > 1 && <span className="text-xs font-normal text-muted">· {imgs.length} photos</span>}</p>
                  {s.note && <p className="truncate text-xs italic text-muted">“{s.note}”</p>}
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted/80">{timeAgo(s.createdAt)}</p>
                </div>
                <Button variant={s.hidden ? 'outline' : 'red'} className={s.hidden ? smallBtn : dangerBtn} onClick={() => setShakeHidden(s.id, !s.hidden)}>
                  {s.hidden ? 'Restore' : 'Remove'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
