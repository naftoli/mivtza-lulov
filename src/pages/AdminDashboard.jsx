import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getSchools, getSchool, getShakes, getKidsForSchool,
  setShakeHidden, resetDemoData, getSchoolReportRows,
  getPendingPhotos, approvePhotos, approveAllPhotos, rejectPhotos,
  getSettings, setPerKidGoal, setSchoolGoal, byGoalProgress, IS_DEMO,
} from '../services/api.js'

// Fixed campaign end (Isru Chag), shown read-only — e.g. "Mon, Oct 5".
const prettyDate = (iso) =>
  new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
import ReportGrid from '../components/ReportGrid.jsx'
import { PhotoLightbox } from '../components/PhotoWall.jsx'
import { useLiveData } from '../lib/useLiveData.js'
import { pendingPhotos } from '../lib/photos.js'
import { fmt, timeAgo } from '../lib/format.js'
import { asset } from '../lib/asset.js'
import { Button, Card, Field, Input, Spinner, Pill, SectionHeader, SchoolLogo, ErrorNote, LulavIcon } from '../components/ui.jsx'

// Shared bits of the admin skin (sky cards on mint, navy / green-deep type).
const label = 'text-[11px] font-semibold uppercase tracking-[0.1em] text-navy'   // small Exo label
const tile = 'rounded-2xl bg-white/55'                                          // soft inset panel on a sky card
const smallBtn = '!px-4 !py-2 !text-[15px]'                                     // compact pill inside cards
// muted red pill (#eb635d = race-red token) for reject / remove — white text
const dangerBtn = `${smallBtn} !bg-race-red !text-white`
// race bar palette in rank order (matches the Home race card)
const RACE = ['var(--color-race-green)', 'var(--color-race-yellow)', 'var(--color-race-blue)', 'var(--color-race-red)', 'var(--color-race-teal)']
const MEDALS = ['medal-gold.png', 'medal-silver.png', 'medal-bronze.png']

function Section({ title, children, right }) {
  return (
    <Card className="p-6">
      {/* wraps so a long hint drops under the title instead of squeezing it */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <SectionHeader>{title}</SectionHeader>
        {right}
      </div>
      {children}
    </Card>
  )
}

export default function AdminDashboard() {
  const { admin, logoutAdmin } = useAuth()
  const { data: schools, error: schoolsError, reload: reloadSchools } = useLiveData(() => getSchools(), [])
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
          {admin.role === 'hq' && IS_DEMO && (
            <Button variant="outline" onClick={() => { if (confirm('Reset ALL demo data back to the sample seed?')) resetDemoData() }}>Reset demo data</Button>
          )}
          <Button variant="ghost" onClick={logoutAdmin}>Log out</Button>
        </div>
      </div>

      {admin.role === 'hq' && !schools && (
        <div className="mt-6">
          {schoolsError ? <ErrorNote error={schoolsError} onRetry={reloadSchools} what="the schools" /> : <Spinner />}
        </div>
      )}

      {admin.role === 'hq' && schools && (
        <div className="mt-6">
          <Section title="All Schools — the Race">
            <div className="space-y-2">
              {[...schools].sort(byGoalProgress).map((s, i) => (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-2xl px-2 py-2 text-left transition hover:bg-white/45 sm:flex sm:gap-3 ${selectedId === s.id ? 'bg-white/55 ring-1 ring-green-mid/50' : ''}`}>
                  <span className="grid w-5 flex-none place-items-center sm:w-8">
                    {MEDALS[i] && s.total > 0
                      ? <img src={asset(`design/${MEDALS[i]}`)} alt={`Rank ${i + 1}`} className="h-5 w-5 object-contain sm:h-8 sm:w-8" />
                      : <span className="font-display text-base font-bold italic text-blue-accent sm:text-lg">{i + 1}</span>}
                  </span>
                  <SchoolLogo school={s} size={32} />
                  <span className="min-w-0 truncate font-semibold text-navy sm:w-36 sm:flex-none">{s.name}</span>
                  <span className="relative order-last col-span-4 h-3 overflow-hidden rounded-full bg-track sm:order-none sm:col-span-1 sm:flex-1">
                    <span className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(s.percent, 3))}%`, background: `linear-gradient(90deg, rgba(255,255,255,.22), rgba(0,28,76,.16)), ${RACE[i % RACE.length]}` }} />
                  </span>
                  <span className="flex-none text-right text-[12px] font-bold tabular-nums text-green sm:w-28 sm:text-[13px]">{fmt(s.total)} · {s.percent}%</span>
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
  const { data: school, error: schoolError, reload: reloadSchool } = useLiveData(() => getSchool(schoolId), [schoolId])
  const { data: shakes, error: shakesError, reload: reloadShakes } = useLiveData(() => getShakes(schoolId, { includeHidden: true }), [schoolId])
  const { data: kids } = useLiveData(() => getKidsForSchool(schoolId), [schoolId])
  const { data: reportRows } = useLiveData(() => getSchoolReportRows(schoolId), [schoolId])
  // Pending photos come back inline, so this is the slowest read on the page. It
  // loads on its own and only its section waits for it.
  const { data: pending, error: pendingError, reload: reloadPending } = useLiveData(() => getPendingPhotos(schoolId), [schoolId])

  if (!school && schoolError) return <div className="mt-6"><ErrorNote error={schoolError} onRetry={reloadSchool} what="this school" /></div>
  if (!school) return <div className="mt-6"><Spinner /></div>

  return (
    <div className="mt-6 space-y-6">
      <CampaignSettings school={school} isHQ={isHQ} />
      {/* Photo Approvals above the roster; "Remove entry" moderation right under it. */}
      <PhotoApprovals schoolId={schoolId} shakes={pending} error={pendingError} onRetry={reloadPending} />
      <Moderation shakes={shakes} error={shakesError} onRetry={reloadShakes} />
      <Roster kids={kids || []} />
      <ReportGrid rows={reportRows || []} />
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
    <Section title="Automatic Goal">
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
  // Blank = automatic; a number = an HQ custom goal for this school.
  const [goalVal, setGoalVal] = useState(school.goalCustom ? String(school.goal) : '')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setGoalVal(school.goalCustom ? String(school.goal) : '')
  }, [school.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault()
    await setSchoolGoal(school.id, goalVal) // '' clears back to automatic
    setSaved(true); setTimeout(() => setSaved(false), 1600)
  }

  return (
    <Section title="Campaign Settings" right={<Pill>{school.percent}% of goal</Pill>}>
      {/* Goal: automatic (soldiers × per-kid) unless HQ sets a custom number. Schools can't. */}
      {isHQ ? (
        <form onSubmit={save}>
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
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="navy">Save</Button>
            {saved && <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-green">✓ Saved</span>}
          </div>
        </form>
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

      {/* End date is fixed to Isru Chag — not editable by anyone. */}
      <div className={`${tile} mt-4 p-4`}>
        <p className={label}>Campaign ends</p>
        <p className="mt-0.5 font-semibold text-navy">{prettyDate(school.endDate)} · Isru Chag Sukkos</p>
      </div>

      <div className={`${tile} mt-4 p-4`}>
        <p className="sh !text-gold-dark">⭐ Bonus Rounds (automatic)</p>
        <p className="mt-1 text-sm text-navy">
          {school.bonusActive
            ? `Round ${school.bonusLevel} — target ${fmt(school.bonusGoal)} shakes. Each round adds ${fmt(school.kidCount)} (1 per soldier), and the next one starts as soon as this target is reached.`
            : `Once ${fmt(school.goal)} is reached, bonus rounds start on their own — each adds ${fmt(school.kidCount)} (1 per soldier), with no limit.`}
        </p>
      </div>
    </Section>
  )
}

// MASHPIA: the roster is READ-ONLY here — soldiers are sourced from Mashpia, not
// added or edited in this UI, so there is no add-soldier form. When Mashpia is
// wired up this list is populated from the server-side roster.
function Roster({ kids }) {
  const [q, setQ] = useState('')

  const byGrade = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? kids.filter((k) => `${k.firstName} ${k.lastName}`.toLowerCase().includes(needle))
      : kids
    const g = {}
    list.forEach((k) => { (g[k.grade || '—'] ??= []).push(k) })
    return g
  }, [kids, q])

  const grades = Object.keys(byGrade).sort()

  return (
    <Section title="Soldier Roster" right={<Pill>{kids.length} soldiers</Pill>}>
      <Field label="Search by name">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search soldiers…" />
      </Field>

      <div className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
        {grades.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No soldiers match “{q}”.</p>
        ) : grades.map((grade) => (
          <div key={grade}>
            <p className={`${label} mb-1`}>Grade {grade}</p>
            <ul className="space-y-1">
              {byGrade[grade].map((k) => (
                <li key={k.id} className="rounded-xl bg-white/55 px-3 py-1.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold text-navy">{k.firstName} {k.lastName}</span>
                    <span className="flex-none text-[11px] font-semibold tabular-nums text-muted">#{k.id}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted/85">
                    {k.rank && <span className="font-bold uppercase tracking-[0.08em] text-gold-dark">{k.rank}</span>}
                    {k.dob && <span className="tabular-nums">DOB {k.dob}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

function PhotoApprovals({ schoolId, shakes, error, onRetry }) {
  const [active, setActive] = useState(null) // photo open in the lightbox
  const [busy, setBusy] = useState(false)
  const [allError, setAllError] = useState(null)
  const loaded = Array.isArray(shakes)

  async function approveAll() {
    if (!confirm(`Approve all ${shakes.length} pending entries? Every photo in them will show on the public page.`)) return
    setBusy(true)
    setAllError(null)
    try {
      await approveAllPhotos(schoolId)
    } catch (e) {
      setAllError(`Could not approve all — ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Photo Approvals"
      right={loaded && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Pill>{shakes.length} pending</Pill>
          {shakes.length > 0 && (
            <Button variant="navy" className={smallBtn} disabled={busy} onClick={approveAll}>
              {busy ? 'Approving…' : `✓ Approve all (${shakes.length})`}
            </Button>
          )}
        </div>
      )}>
      {allError && <p role="alert" className="mb-3 rounded-xl bg-white/60 px-3 py-2 text-sm font-semibold text-red">{allError}</p>}
      {!loaded ? (
        // Only this section waits on the photos; the rest of the page is already up.
        error ? <ErrorNote error={error} onRetry={onRetry} what="the pending photos" /> : <Spinner label="Loading photos…" />
      ) : shakes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing to review — all photos approved. ✓</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-muted">Photos are hidden from the public page until you approve them. Approving an entry publishes the photos shown on it — tap a thumbnail to see it full size.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {shakes.map((s) => <PendingEntry key={s.id} entry={s} onOpen={setActive} />)}
          </div>
        </>
      )}
      <PhotoLightbox photo={active} onClose={() => setActive(null)} />
    </Section>
  )
}

// One entry awaiting review. It holds its own busy/error state so a failed
// approve or reject says so on that card, and a slow one cannot be sent twice.
function PendingEntry({ entry: s, onOpen }) {
  const [busy, setBusy] = useState(null) // 'approve' | 'reject' while the request runs
  const [done, setDone] = useState(null) // what succeeded, until the list refresh drops the card
  const [error, setError] = useState(null)
  // Only the photos still waiting: a day can also hold ones approved earlier,
  // which are already public and are not what these buttons act on.
  const imgs = pendingPhotos(s)

  async function review(action) {
    setBusy(action)
    setError(null)
    try {
      await (action === 'approve' ? approvePhotos : rejectPhotos)(s.id)
      setDone(action)
    } catch (e) {
      setError(`Could not ${action} — ${e.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`${tile} p-3`}>
      {/* every pending photo in the entry — the admin must be able to see what Approve will publish */}
      <div className="flex flex-wrap gap-2">
        {imgs.map((img, i) => (
          <button key={i} type="button" onClick={() => onOpen({ ...s, photo: img })}
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
        {done ? (
          <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.08em] text-green">{done === 'approve' ? '✓ Approved' : 'Rejected'}</p>
        ) : (
          <div className="mt-2 flex gap-2">
            <Button variant="navy" className={smallBtn} disabled={!!busy} onClick={() => review('approve')}>
              {busy === 'approve' ? 'Approving…' : `✓ Approve${imgs.length > 1 ? ` all ${imgs.length}` : ''}`}
            </Button>
            <Button variant="red" className={dangerBtn} disabled={!!busy} onClick={() => review('reject')}>
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </Button>
          </div>
        )}
        {error && <p role="alert" className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold text-red">{error}</p>}
      </div>
    </div>
  )
}

// Sort options for the "Remove entry" list.
const MOD_SORTS = {
  shakes: { label: 'Most shakes', fn: (a, b) => b.count - a.count },
  name: { label: 'Name', fn: (a, b) => String(a.kidName).localeCompare(String(b.kidName)) },
  newest: { label: 'Newest', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  oldest: { label: 'Oldest', fn: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
}

function Moderation({ shakes, error, onRetry }) {
  const [sort, setSort] = useState('shakes')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(10)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = shakes || []
    const base = needle ? all.filter((s) => String(s.kidName).toLowerCase().includes(needle)) : all
    return [...base].sort(MOD_SORTS[sort].fn)
  }, [shakes, q, sort])

  // Reset the reveal whenever the search or sort changes.
  useEffect(() => { setLimit(10) }, [q, sort])

  const shown = filtered.slice(0, limit)
  const remaining = filtered.length - shown.length

  return (
    <Section title="Remove Mivtza Lulov Entry"
      right={<span className="text-xs text-muted">Hidden entries don’t count toward the goal or show publicly</span>}>
      {!shakes ? (
        // An admin's entries carry their pending photos inline too, so this can lag the rest of the page.
        error ? <ErrorNote error={error} onRetry={onRetry} what="the entries" /> : <Spinner label="Loading entries…" />
      ) : shakes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No entries yet.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Search by name"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search soldiers…" /></Field>
            <label className="flex items-center gap-2">
              <span className={`${label} flex-none`}>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-blue focus:ring-2 focus:ring-blue/25">
                {Object.entries(MOD_SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No entries match “{q}”.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {shown.map((s) => {
                const imgs = s.photos?.length ? s.photos : s.photo ? [s.photo] : []
                return (
                  <div key={s.id} className={`flex items-start gap-3 rounded-2xl p-3 ${s.hidden ? 'bg-race-red/12 ring-1 ring-race-red/45' : 'bg-white/55'}`}>
                    {imgs[0]
                      ? <img src={imgs[0]} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" />
                      : <span className="grid h-14 w-14 flex-none place-items-center rounded-xl bg-track"><LulavIcon className="h-10" /></span>}
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

          {remaining > 0 && (
            <div className="mt-4 text-center">
              <Button variant="outline" className={smallBtn} onClick={() => setLimit((n) => n + 10)}>Show more ({remaining})</Button>
            </div>
          )}
        </>
      )}
    </Section>
  )
}
