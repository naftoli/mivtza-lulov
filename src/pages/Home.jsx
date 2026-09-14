import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getSchools, getGlobalStats } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, daysLeft, shortSchoolName } from '../lib/format.js'
import { Button, Card, Spinner, Pill, SectionHeader, SchoolLogo } from '../components/ui.jsx'
import GoalMeter from '../components/GoalMeter.jsx'

function Stat({ value, label, icon, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-xl text-2xl" style={{ background: `${color}18` }}>{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-medium leading-tight tabular-nums text-navy">{value}</div>
        <div className="font-cond text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:whitespace-nowrap">{label}</div>
      </div>
    </div>
  )
}

function SchoolsRace({ schools }) {
  const [sort, setSort] = useState('percent')
  const ranked = [...schools].sort((a, b) => (sort === 'percent' ? b.percent - a.percent : b.total - a.total))
  return (
    <Card className="p-6" topColor="var(--color-gold)">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionHeader>🏁 The Race</SectionHeader>
          <h2 className="font-display text-2xl font-medium text-navy">Schools going head to head</h2>
        </div>
        <div className="inline-flex rounded-lg bg-track p-1 font-cond text-[13px] font-semibold uppercase tracking-wide">
          <button onClick={() => setSort('percent')}
            className={`rounded-md px-3 py-1.5 transition ${sort === 'percent' ? 'bg-white text-navy shadow-sm' : 'text-muted'}`}>% of goal</button>
          <button onClick={() => setSort('total')}
            className={`rounded-md px-3 py-1.5 transition ${sort === 'total' ? 'bg-white text-navy shadow-sm' : 'text-muted'}`}>Total shakes</button>
        </div>
      </div>
      <div className="space-y-2.5">
        {ranked.map((s, i) => (
          <Link key={s.id} to={`/s/${s.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg px-2 py-2 transition hover:bg-paper sm:flex-nowrap sm:gap-3">
            <span className="w-7 flex-none text-center text-lg font-bold text-navy">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
            <SchoolLogo school={s} size={34} />
            <span className="min-w-0 flex-1 truncate font-semibold text-navy sm:w-40 sm:flex-none">{s.name}</span>
            {/* Below sm the bar drops to its own full-width line so it can never be squeezed to 0px. */}
            <span className="relative order-last h-4 basis-full overflow-hidden rounded-full bg-track sm:order-none sm:flex-1">
              <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.max(s.percent, 3)}%`, background: s.color }} />
            </span>
            <span className="w-14 flex-none text-right font-cond text-sm font-bold tabular-nums text-navy sm:w-24">
              {sort === 'percent' ? `${s.percent}%` : fmt(s.total)}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Ranked by {sort === 'percent' ? 'percent of each school’s own goal — so every school competes fairly' : 'total shakes logged'}.
      </p>
    </Card>
  )
}

function SchoolCard({ s }) {
  return (
    <Link to={`/s/${s.id}`} className="group block">
      <Card className="h-full transition group-hover:-translate-y-[3px] group-hover:shadow-hover" topColor={s.color}>
        <div className="flex items-start gap-3 px-5 pt-5">
          <SchoolLogo school={s} size={48} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-medium text-navy">{shortSchoolName(s)}</h3>
            <p className="font-cond text-[11px] uppercase tracking-[0.12em] text-muted">{s.city}</p>
          </div>
          {s.bonusActive ? <Pill className="!bg-gold/20 !text-gold-dark">⭐ Bonus</Pill>
            : s.goalReached ? <Pill className="!bg-green/15 !text-green">🎉 Goal</Pill> : null}
        </div>
        <div className="px-5 pb-5 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-medium tabular-nums text-navy">{fmt(s.total)}</span>
            <span className="text-sm text-muted">of {fmt(s.activeGoal)} shakes</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(s.percent, 3)}%`, background: s.color }} />
          </div>
          <div className="mt-2 flex items-center justify-between font-cond text-[12px] font-semibold uppercase tracking-wide">
            <span style={{ color: s.color }}>{s.percent}% there</span>
            <span className="text-muted">{daysLeft(s.endDate)} days left</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export default function Home() {
  const { data: schools, loading } = useLiveData(() => getSchools(), [])
  const { data: stats } = useLiveData(() => getGlobalStats(), [])

  return (
    <div>
      {/* Hero */}
      <section className="hero-navy">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="font-cond text-[12.5px] font-semibold uppercase tracking-[0.24em] text-gold">Sukkos 5787 · Nationwide Mivtza</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-normal leading-tight sm:text-5xl">
            Every soldier. Every Lulav. <span className="text-gold">One giant mission.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Tzivos Hashem soldiers are hitting the streets to help every Yid shake the Lulav and Esrog.
            Pick your school, watch the count climb, and join the mivtza!
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button to="/login" variant="gold">I'm a Soldier — Log Shakes</Button>
            <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-o-white">See the Campaigns</button>
          </div>
        </div>
      </section>

      {/* Nationwide goal + global stats */}
      {stats && (
        <section className="relative z-10 mx-auto -mt-8 max-w-5xl px-4">
          <Card className="p-6">
            <SectionHeader>🌿 One Giant Mission · Nationwide</SectionHeader>
            <div className="mt-3">
              <GoalMeter
                school={{
                  name: 'Nationwide',
                  total: stats.totalShakes,
                  activeGoal: stats.totalGoal,
                  goal: stats.totalGoal,
                  percent: Math.min(100, Math.round((stats.totalShakes / Math.max(1, stats.totalGoal)) * 100)),
                  goalReached: stats.totalShakes >= stats.totalGoal,
                  bonusActive: false,
                  color: 'var(--color-green)',
                }}
                celebrateMilestones={false}
              />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3 sm:gap-5">
              <Stat icon="🎖️" color="#c8951a" value={fmt(stats.activeSoldiers)} label="Soldiers" />
              <Stat icon="🏫" color="#8a6d1f" value={fmt(stats.totalSchools)} label="Schools" />
              <Stat icon="📸" color="#2f6f5f" value={fmt(stats.totalPhotos)} label="Field Photos" />
            </div>
          </Card>
        </section>
      )}

      {schools && schools.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-12"><SchoolsRace schools={schools} /></section>
      )}

      <section id="schools" className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6">
          <SectionHeader>Join a Campaign</SectionHeader>
          <h2 className="font-display text-2xl font-medium text-navy">School Campaigns</h2>
        </div>
        {loading || !schools ? <Spinner /> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {schools.map((s) => <SchoolCard key={s.id} s={s} />)}
          </div>
        )}
      </section>
    </div>
  )
}
