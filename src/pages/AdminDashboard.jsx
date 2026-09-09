import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getSchools, getSchool, getShakes, getKidsForSchool,
  updateSchool, setShakeHidden, addKid, resetDemoData, getReportsForSchool,
} from '../services/api.js'
import ReportGrid from '../components/ReportGrid.jsx'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, timeAgo } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { Button, Card, Field, Input, Spinner, Pill, SectionHeader, SchoolLogo } from '../components/ui.jsx'

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
          <p className="font-cond text-[11px] font-semibold uppercase tracking-[0.16em] text-red">{admin.role === 'hq' ? 'HQ Command Center' : 'School Admin'}</p>
          <h1 className="font-display text-3xl font-medium text-navy">{admin.name}</h1>
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
            <div className="space-y-2.5">
              {[...schools].sort((a, b) => b.percent - a.percent).map((s, i) => (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-paper sm:gap-3 ${selectedId === s.id ? 'bg-paper ring-1 ring-line' : ''}`}>
                  <span className="w-5 flex-none text-center font-bold text-navy sm:w-6">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                  <SchoolLogo school={s} size={32} />
                  <span className="w-24 flex-none truncate font-semibold text-navy sm:w-36">{s.name}</span>
                  <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-track">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(s.percent, 3)}%`, background: s.color }} />
                  </span>
                  <span className="w-20 flex-none text-right font-cond text-[13px] font-bold tabular-nums text-navy sm:w-28 sm:text-sm">{fmt(s.total)} · {s.percent}%</span>
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}

      {selectedId && (
        <div className="mt-6">
          {admin.role === 'hq' && (
            <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {selectedSchool && <SchoolLogo school={selectedSchool} size={40} />}
                <div>
                  <p className="font-cond text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-dark">Managing as HQ</p>
                  <p className="font-display text-lg font-medium text-navy">{selectedSchool?.name}</p>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <span className="font-cond text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Switch school</span>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-blue focus:ring-2 focus:ring-blue/25">
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </Card>
          )}
          <SchoolAdmin key={selectedId} schoolId={selectedId} />
        </div>
      )}
    </div>
  )
}

function SchoolAdmin({ schoolId }) {
  const { data: school } = useLiveData(() => getSchool(schoolId), [schoolId])
  const { data: shakes } = useLiveData(() => getShakes(schoolId, { includeHidden: true }), [schoolId])
  const { data: kids } = useLiveData(() => getKidsForSchool(schoolId), [schoolId])
  const { data: reports } = useLiveData(() => getReportsForSchool(schoolId), [schoolId])

  if (!school) return <div className="mt-6"><Spinner /></div>

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CampaignSettings school={school} />
        <Roster schoolId={schoolId} kids={kids || []} />
      </div>
      <ReportGrid kids={kids || []} reports={reports || []} />
      <Moderation shakes={shakes || []} />
    </div>
  )
}

function CampaignSettings({ school }) {
  const [form, setForm] = useState({ goal: school.goal, bonusGoal: school.bonusGoal, motto: school.motto, endDate: school.endDate })
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setForm({ goal: school.goal, bonusGoal: school.bonusGoal, motto: school.motto, endDate: school.endDate })
  }, [school.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault()
    await updateSchool(school.id, { goal: Number(form.goal), bonusGoal: Number(form.bonusGoal), motto: form.motto, endDate: form.endDate })
    setSaved(true); setTimeout(() => setSaved(false), 1600)
  }
  async function toggleBonus() {
    const turningOn = !school.bonusActive
    await updateSchool(school.id, { bonusActive: turningOn })
    if (turningOn) celebrate(1.6)
  }

  return (
    <Section title="Campaign Settings" topColor={school.color} right={<Pill>{school.percent}% of goal</Pill>}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shake goal"><Input type="number" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>
          <Field label="Bonus stretch goal"><Input type="number" value={form.bonusGoal} onChange={(e) => setForm({ ...form, bonusGoal: e.target.value })} /></Field>
        </div>
        <Field label="Motto"><Input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></Field>
        <Field label="End date"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="navy">Save</Button>
          {saved && <span className="font-cond text-sm font-semibold uppercase text-green">✓ Saved</span>}
        </div>
      </form>

      <div className="mt-5 rounded-xl bg-gold/8 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sh !text-gold-dark">⭐ Bonus Round</p>
            <p className="mt-1 text-sm text-navy">
              {school.bonusActive ? `Active — chasing ${fmt(school.bonusGoal)} shakes.`
                : school.goalReached ? 'Goal reached! You can launch the bonus round now.'
                : `Unlocks once ${fmt(school.goal)} shakes are reached.`}
            </p>
          </div>
          <Button variant={school.bonusActive ? 'outline' : 'gold'} onClick={toggleBonus} disabled={!school.goalReached && !school.bonusActive}>
            {school.bonusActive ? 'End bonus' : 'Launch bonus 🚀'}
          </Button>
        </div>
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
          {error && <p className="mb-2 rounded-lg bg-red/8 px-3 py-2 text-sm text-red">{error}</p>}
          <Button type="submit" variant="outline" className="w-full">+ Add soldier</Button>
        </div>
      </form>

      <div className="mt-4 max-h-52 space-y-3 overflow-auto pr-1">
        {Object.keys(byGrade).sort().map((grade) => (
          <div key={grade}>
            <p className="mb-1 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Grade {grade}</p>
            <ul className="space-y-1">
              {byGrade[grade].map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-1.5 text-sm">
                  <span className="truncate font-semibold text-navy">{k.firstName} {k.lastName}</span>
                  <span className="flex flex-none items-center gap-2">
                    {k.rank && <span className="font-cond text-[10px] uppercase tracking-wide text-gold-dark">{k.rank}</span>}
                    <span className="font-cond text-xs uppercase tracking-wide text-muted">#{k.id}</span>
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
              <div key={s.id} className={`flex items-start gap-3 rounded-xl border p-3 ${s.hidden ? 'border-red/40 bg-red/5' : 'border-line'}`}>
                {imgs[0]
                  ? <img src={imgs[0]} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />
                  : <span className="grid h-14 w-14 flex-none place-items-center rounded-lg bg-paper">🌿</span>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{s.kidName} · {fmt(s.count)} shakes {imgs.length > 1 && <span className="text-xs text-muted">· {imgs.length} photos</span>}</p>
                  {s.note && <p className="truncate text-xs italic text-muted">“{s.note}”</p>}
                  <p className="font-cond text-[11px] uppercase tracking-[0.08em] text-muted/70">{timeAgo(s.createdAt)}</p>
                </div>
                <Button variant={s.hidden ? 'outline' : 'red'} className="!px-3 !py-1.5 !text-[11px]" onClick={() => setShakeHidden(s.id, !s.hidden)}>
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
