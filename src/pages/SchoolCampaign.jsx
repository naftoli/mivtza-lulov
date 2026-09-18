import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSchool, getShakes, getLeaderboard, getClassLeaderboard } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, shortSchoolName } from '../lib/format.js'
import { asset } from '../lib/asset.js'
import { Button, Card, Spinner, SchoolLogo, ErrorNote } from '../components/ui.jsx'
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
        <div className="font-display text-2xl font-black leading-tight tabular-nums text-navy">{value}</div>
        <div className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-navy">{label}</div>
      </div>
    </div>
  )
}

export default function SchoolCampaign() {
  const { schoolId } = useParams()
  const { kid } = useAuth()
  const [showShare, setShowShare] = useState(false)
  const { data: school, loading, error, reload } = useLiveData(() => getSchool(schoolId), [schoolId])
  const { data: shakes } = useLiveData(() => getShakes(schoolId), [schoolId])
  const { data: board } = useLiveData(() => getLeaderboard(schoolId), [schoolId])
  const { data: classBoard } = useLiveData(() => getClassLeaderboard(schoolId), [schoolId])

  if (loading) return <div className="mx-auto max-w-6xl px-4"><Spinner /></div>
  // A failed request is not a missing school — say so, and offer a retry.
  if (error) return <div className="mx-auto max-w-2xl px-4 py-20"><ErrorNote error={error} onRetry={reload} what="this campaign" /></div>
  if (!school) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-black text-navy">School not found</h1>
        <Button to="/" className="mt-4" variant="navy">Back to campaigns</Button>
      </div>
    )
  }

  const isMySchool = kid?.schoolId === school.id
  const photoCount = (shakes || []).reduce((n, s) => n + (s.photos?.length || (s.photo ? 1 : 0)), 0)
  const avgPerSoldier = school.soldierCount ? Math.round(school.total / school.soldierCount) : 0

  return (
    <div>
      {/* Hero: Mivtza Lulav + School Name + School Logo — the comp's treatment:
          the city photo, dimmed under a green-deep wash, with the content in
          the green glass panel (gold eyebrow, white Exo Black name). */}
      <section className="relative overflow-hidden">
        <img src={asset('design/hero-city.jpg')} alt="" aria-hidden="true" draggable="false"
          className="absolute inset-0 h-full w-full select-none object-cover object-[50%_65%]" />
        <div className="absolute inset-0 bg-green/55" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-green/45 to-transparent" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-9">
          <div className="hero-glass rounded-[28px] p-5 sm:rounded-[36px] sm:px-8 sm:py-7">
            <Link to="/" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75 hover:text-white">← Army Wide Campaign</Link>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <SchoolLogo school={school} size={72} className="ring-2 ring-white/30" />
                <div className="min-w-0">
                  <p className="font-display text-[13px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[16px]">Mivtza Lulav</p>
                  <h1 className="font-display text-[26px] font-black uppercase leading-[1.1] text-white sm:text-4xl lg:text-[40px]">{shortSchoolName(school)}</h1>
                  <p className="mt-1 font-display text-white/85 sm:text-[17px]">{school.city}</p>
                </div>
              </div>
              {/* Share moved up here (where the days-left pill used to be) */}
              <Button variant="outlineWhite" onClick={() => setShowShare(true)}>↗ Share</Button>
            </div>
            {/* Soldier CTA — prominent pill on the green hero band, above the meter */}
            <div className="mt-5">
              <Button to={isMySchool ? '/me' : '/login'} variant="gold" className="w-full sm:w-auto sm:min-w-[240px]">
                I'm a Soldier — Log Shakes
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.6fr_1fr] lg:gap-8 lg:py-10">
        {/* Left column */}
        <div className="space-y-6">
          <Card className="p-6" topColor={school.color}>
            <GoalMeter school={school} variant="wide" />
          </Card>

          {school.bonusActive ? (
            <Card className="!bg-green p-5 text-white sm:p-6">
              <p className="sh !text-gold">⭐ Bonus Round is ON</p>
              <p className="mt-1 text-sm text-white/90">
                {school.name} crushed the goal of {fmt(school.goal)} shakes. Every shake now counts toward a
                stretch goal of <strong className="text-gold">{fmt(school.bonusGoal)}</strong>. Keep going, soldiers!
              </p>
            </Card>
          ) : school.goalReached ? (
            <Card className="p-5 ring-2 ring-inset ring-green-mid/70 sm:p-6">
              <p className="sh">🎉 Goal reached!</p>
              <p className="mt-1 text-sm text-navy">The goal is complete — the school can unlock a <strong>bonus round</strong> to push even further.</p>
            </Card>
          ) : null}

          <PhotoWall shakes={shakes || []} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <RecentShakes shakes={(shakes || []).slice(0, 8)} />
          <Leaderboard rows={board || []} highlightKidKey={kid?.kidKey} />
          <ClassLeaderboard rows={classBoard || []} highlightGrade={kid?.grade} />
        </div>
      </div>

      {showShare && <SharePanel school={school} onClose={() => setShowShare(false)} />}
    </div>
  )
}
