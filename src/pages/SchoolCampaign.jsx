import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSchool, getShakes, getLeaderboard, getClassLeaderboard } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, daysLeft, shortSchoolName } from '../lib/format.js'
import { Button, Card, Spinner, Pill, SchoolLogo } from '../components/ui.jsx'
import GoalMeter from '../components/GoalMeter.jsx'
import RecentShakes from '../components/RecentShakes.jsx'
import PhotoWall from '../components/PhotoWall.jsx'
import Leaderboard from '../components/Leaderboard.jsx'
import ClassLeaderboard from '../components/ClassLeaderboard.jsx'
import SharePanel from '../components/SharePanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function Stat({ value, label, icon, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-xl text-2xl" style={{ background: `${color}18` }}>{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-medium leading-tight tabular-nums text-navy">{value}</div>
        <div className="whitespace-nowrap font-cond text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
      </div>
    </div>
  )
}

export default function SchoolCampaign() {
  const { schoolId } = useParams()
  const { kid } = useAuth()
  const [showShare, setShowShare] = useState(false)
  const { data: school, loading } = useLiveData(() => getSchool(schoolId), [schoolId])
  const { data: shakes } = useLiveData(() => getShakes(schoolId), [schoolId])
  const { data: board } = useLiveData(() => getLeaderboard(schoolId), [schoolId])
  const { data: classBoard } = useLiveData(() => getClassLeaderboard(schoolId), [schoolId])

  if (loading) return <div className="mx-auto max-w-6xl px-4"><Spinner /></div>
  if (!school) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-medium text-navy">School not found</h1>
        <Button to="/" className="mt-4" variant="navy">Back to campaigns</Button>
      </div>
    )
  }

  const isMySchool = kid?.schoolId === school.id
  const photoCount = (shakes || []).reduce((n, s) => n + (s.photos?.length || (s.photo ? 1 : 0)), 0)
  const avgPerSoldier = school.soldierCount ? Math.round(school.total / school.soldierCount) : 0

  return (
    <div>
      {/* Hero: Mivtza Lulav + School Name + School Logo */}
      <section className="hero-navy">
        <div className="mx-auto max-w-6xl px-4 py-9">
          <Link to="/" className="text-[12px] uppercase tracking-[0.14em] text-white/70 hover:text-white">← All campaigns</Link>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <SchoolLogo school={school} size={72} className="ring-2 ring-white/20" />
              <div>
                <p className="font-cond text-[12px] font-semibold uppercase tracking-[0.22em] text-gold">Mivtza Lulav</p>
                <h1 className="font-display text-4xl font-normal text-white">{shortSchoolName(school)}</h1>
                <p className="mt-0.5 text-white/85">{school.city} · “{school.motto}”</p>
              </div>
            </div>
            <Pill className="!bg-white/10 !text-white">⏳ {daysLeft(school.endDate)} days left</Pill>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          <Card className="p-6" topColor={school.color}>
            <GoalMeter school={school} variant="wide"
              actions={isMySchool
                ? <Button to="/me" variant="gold">Log my shakes</Button>
                : <Button to="/login" variant="gold">I'm a soldier here</Button>}
              centerAction={<Button variant="outline" onClick={() => setShowShare(true)}>↗ Share</Button>}
            />
          </Card>

          {school.bonusActive ? (
            <Card className="border-l-4 !border-l-gold bg-gold/5 p-5">
              <p className="sh !text-gold-dark">⭐ Bonus Round is ON</p>
              <p className="mt-1 text-sm text-navy">
                {school.name} crushed the goal of {fmt(school.goal)} shakes. Every shake now counts toward a
                stretch goal of <strong>{fmt(school.bonusGoal)}</strong>. Keep going, soldiers!
              </p>
            </Card>
          ) : school.goalReached ? (
            <Card className="border-l-4 !border-l-green bg-green/5 p-5">
              <p className="sh !text-green">🎉 Goal reached!</p>
              <p className="mt-1 text-sm text-navy">The goal is complete — the school can unlock a <strong>bonus round</strong> to push even further.</p>
            </Card>
          ) : null}

          <PhotoWall shakes={shakes || []} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <RecentShakes shakes={(shakes || []).slice(0, 8)} />
          <Leaderboard rows={board || []} highlightKidId={kid?.id} />
          <ClassLeaderboard rows={classBoard || []} highlightGrade={kid?.grade} />
        </div>
      </div>

      {showShare && <SharePanel school={school} onClose={() => setShowShare(false)} />}
    </div>
  )
}
