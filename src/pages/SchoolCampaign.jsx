import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSchool, getShakes, getLeaderboard, getClassLeaderboard } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, shortSchoolName } from '../lib/format.js'
import { asset } from '../lib/asset.js'
import { CAMPAIGN_YEAR } from '../lib/succos.js'
import { Button, Card, Spinner, SchoolLogo, ErrorNote, Pill } from '../components/ui.jsx'
import GoalBar from '../components/GoalBar.jsx'
import RecentShakes from '../components/RecentShakes.jsx'
import PhotoWall from '../components/PhotoWall.jsx'
import Leaderboard from '../components/Leaderboard.jsx'
import ClassLeaderboard from '../components/ClassLeaderboard.jsx'
import SharePanel from '../components/SharePanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// Same stat tile as the home page: 3D icon, big navy number, caps label.
function Stat({ value, label, icon }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="grid h-[68px] w-[84px] flex-none place-items-center lg:h-[84px] lg:w-[108px]">
        <img src={icon} alt="" aria-hidden="true" draggable="false" className="max-h-full max-w-full object-contain" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-[30px] font-black leading-none tabular-nums text-navy lg:text-[36px]">{value}</div>
        <div className="mt-1 font-display text-[16px] font-semibold uppercase leading-tight text-navy sm:text-[17px] lg:text-[20px] xl:text-[24px]">{label}</div>
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
              <Button to={kid ? '/me' : '/login'} variant="gold" className="w-full sm:w-auto sm:min-w-[240px]">
                I'm a Soldier — Log Shakes
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:space-y-8 lg:py-10">
        {/* Goal summary — the home page's treatment: Goal / Total Shakes / % over
            the lulav goal-bar, then stat tiles. No "Schools" tile (one school). */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-display text-[15px] font-extrabold uppercase tracking-[0.02em] text-green sm:text-[18px]">
              <img src={asset('design/lulav-esrog.png')} alt="" aria-hidden="true" draggable="false" className="h-6 w-auto sm:h-7" />
              <span>Mivtza Lulov {CAMPAIGN_YEAR}</span>
            </p>
            {school.goalReached && <Pill className="!bg-green !text-white">🎉 Goal reached!</Pill>}
          </div>

          <div className="relative z-10 mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 sm:mt-5 sm:gap-x-12">
            <div>
              <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Goal</p>
              <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[40px] lg:text-[44px]">{fmt(school.goal)}</p>
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Total Shakes</p>
              <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-green sm:text-[40px] lg:text-[44px]">{fmt(school.total)}</p>
            </div>
            <p className="ml-auto hidden font-display text-[30px] font-black leading-none tabular-nums text-green [paint-order:stroke_fill] [-webkit-text-stroke:8px_var(--color-card)] sm:block sm:text-[40px] lg:text-[44px]">{school.percent}%</p>
          </div>

          <div className="mt-5 flex items-center gap-3 sm:mt-0 sm:block">
            <GoalBar percent={school.percent} className="min-w-0 flex-1 sm:mt-6 sm:mr-[144px] lg:mr-[156px]" />
            <span className="flex-none font-display text-[26px] font-black leading-none tabular-nums text-green sm:hidden">{school.percent}%</span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:mt-10 lg:gap-8">
            <Stat icon={asset('design/icon-soldier-hat.png')} value={fmt(school.kidCount)} label="Soldiers" />
            <Stat icon={asset('design/icon-clock.png')} value={fmt(school.totalMinutes || 0)} label="Minutes" />
            <Stat icon={asset('design/icon-camera.png')} value={fmt(school.totalPhotos || 0)} label="Photos" />
          </div>
        </Card>

        {school.bonusActive ? (
          <Card className="!bg-green p-5 text-white sm:p-6">
            <p className="sh !text-gold">⭐ Bonus Round {school.bonusLevel} is ON</p>
            <p className="mt-1 text-sm text-white/90">
              {school.name} crushed the goal of {fmt(school.goal)} shakes. Every shake now counts toward the
              round {school.bonusLevel} target of <strong className="text-gold">{fmt(school.bonusGoal)}</strong> — reach
              it and the next round starts. Keep going, soldiers!
            </p>
          </Card>
        ) : null}

        {/* Photos beside the live feed (feed stretched to end level with them) */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-stretch lg:gap-8">
          <PhotoWall shakes={shakes || []} />
          <RecentShakes shakes={(shakes || []).slice(0, 8)} fill />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
          <Leaderboard rows={board || []} highlightKidKey={kid?.kidKey} />
          <ClassLeaderboard rows={classBoard || []} highlightGrade={isMySchool ? kid?.grade : undefined} highlightClassId={isMySchool ? kid?.classId : undefined} />
        </div>
      </div>

      {showShare && <SharePanel school={school} onClose={() => setShowShare(false)} />}
    </div>
  )
}
