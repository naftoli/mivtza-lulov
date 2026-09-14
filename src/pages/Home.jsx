import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getSchools, getGlobalStats } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, daysLeft, shortSchoolName } from '../lib/format.js'
import { asset } from '../lib/asset.js'
import { Button, Card, Spinner, Pill, SchoolLogo } from '../components/ui.jsx'
import GoalBar from '../components/GoalBar.jsx'

// Race bar fills — one per rank, cycling, each a light -> full gradient of the
// comp's race palette (green, yellow, blue, red, teal).
const RACE_FILLS = [
  'linear-gradient(90deg, #8fd89d 0%, var(--color-race-green) 45%, #3f9a55 100%)',
  'linear-gradient(90deg, #fde58f 0%, var(--color-race-yellow) 55%, #f0b929 100%)',
  'linear-gradient(90deg, #86a8db 0%, var(--color-race-blue) 55%, #2f5fa6 100%)',
  'linear-gradient(90deg, #f6a09a 0%, var(--color-race-red) 55%, #d9463f 100%)',
  'linear-gradient(90deg, #6fd0c3 0%, var(--color-race-teal) 55%, #0b8a7e 100%)',
]
const MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze']

// Card eyebrow: small 3D icon + Exo extrabold caps in green-deep.
function Eyebrow({ icon, iconClass = 'h-5', className = '', children }) {
  return (
    <p className={`flex items-center gap-2 font-display text-[15px] font-extrabold uppercase leading-none tracking-[0.02em] text-green sm:text-[18px] ${className}`}>
      {icon && <img src={icon} alt="" aria-hidden="true" draggable="false" className={`w-auto flex-none ${iconClass}`} />}
      <span>{children}</span>
    </p>
  )
}

// Stat tile: 3D icon at left (rendered at 1x — never upscaled), big navy number, caps label.
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

function SchoolsRace({ schools }) {
  const [sort, setSort] = useState('percent')
  const ranked = [...schools].sort((a, b) => (sort === 'percent' ? b.percent - a.percent : b.total - a.total))
  // Toggle: green pill, the active segment darker (spec: #549182 vs #69c07c) — in the
  // comp it shades sky -> teal-green from left to right. Condensed caps, green-deep text.
  const seg = (active) =>
    `rounded-full px-3.5 py-2 text-green transition sm:px-5 ${active ? 'shadow-sm' : 'hover:bg-white/15'}`
  const segStyle = (active) => (active ? { background: 'linear-gradient(90deg, #a6e0f6 0%, #6db58d 45%, #549182 100%)' } : undefined)
  return (
    <Card className="rounded-[32px] p-5 sm:rounded-[40px] sm:p-10 lg:px-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-7">
        <div className="min-w-0">
          <Eyebrow icon={asset('design/flag.png')} iconClass="h-[22px]">The Race</Eyebrow>
          <h2 className="mt-1.5 font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">Schools going head to head</h2>
        </div>
        <div className="inline-flex rounded-full bg-[#69c07c] p-1 font-cond text-[15px] uppercase leading-none tracking-[0.04em] sm:text-[17px]">
          <button type="button" onClick={() => setSort('percent')} className={seg(sort === 'percent')} style={segStyle(sort === 'percent')}>% of goal</button>
          <button type="button" onClick={() => setSort('total')} className={seg(sort === 'total')} style={segStyle(sort === 'total')}>Total shakes</button>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {ranked.map((s, i) => (
          <Link
            key={s.id}
            to={`/s/${s.id}`}
            className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl px-2 py-2.5 transition hover:bg-white/40 sm:flex sm:gap-4 sm:px-3 lg:gap-5"
          >
            <span className="grid w-9 flex-none place-items-center sm:w-12 lg:w-14">
              {i < 3
                ? <img src={asset(`design/${MEDALS[i]}.png`)} alt={`#${i + 1}`} draggable="false" className="h-9 w-auto sm:h-[46px] lg:h-[52px]" />
                : <span className="font-display text-[20px] font-bold italic leading-none text-blue-accent sm:text-[24px]">{i + 1}</span>}
            </span>
            <SchoolLogo school={s} size={44} />
            <span className="min-w-0 truncate font-display text-[17px] font-semibold text-navy sm:w-40 sm:flex-none sm:text-[19px] lg:w-56 lg:text-[20px] xl:w-64">{s.name}</span>
            <span className="relative col-span-4 h-4 overflow-hidden rounded-full bg-track sm:order-none sm:col-span-1 sm:h-5 sm:flex-1 order-last">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.max(s.percent, 3)}%`, background: RACE_FILLS[i % RACE_FILLS.length] }}
              />
            </span>
            <span className="text-right font-display text-[16px] font-bold tabular-nums text-green sm:w-16 sm:flex-none sm:text-[18px] lg:w-24 lg:text-[20px]">
              {sort === 'percent' ? `${s.percent}%` : fmt(s.total)}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-5 font-display text-[13px] font-light italic text-navy sm:text-[14px]">
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
            <h3 className="font-display text-xl font-bold leading-tight text-navy">{shortSchoolName(s)}</h3>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-green">{s.city}</p>
          </div>
          {s.bonusActive ? <Pill className="!bg-gold/25 !text-gold-dark">⭐ Bonus</Pill>
            : s.goalReached ? <Pill className="!bg-green !text-white">🎉 Goal</Pill> : null}
        </div>
        <div className="px-5 pb-5 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-[28px] font-black leading-none tabular-nums text-navy">{fmt(s.total)}</span>
            <span className="text-sm font-semibold text-muted">of {fmt(s.activeGoal)} shakes</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(s.percent, 3)}%`, background: s.color }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[13px] font-semibold uppercase tracking-[0.04em]">
            <span className="text-green">{s.percent}% there</span>
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

  const percent = stats ? Math.min(100, Math.round((stats.totalShakes / Math.max(1, stats.totalGoal)) * 100)) : 0
  const goalReached = !!stats && stats.totalShakes >= stats.totalGoal

  return (
    <div>
      {/* Hero — full-bleed city photo, green glass panel left, soldier cutout right.
          `isolate` keeps the panel/boy z-order inside the hero, so the nationwide
          card (z-10, pulled up over the hero) paints over the boy's feet as in the comp. */}
      <section className="relative isolate flex min-h-[520px] md:min-h-[600px]">
        <img
          src={asset('design/hero-city.jpg')}
          alt=""
          draggable="false"
          className="absolute inset-0 h-full w-full select-none object-cover object-[62%_center]"
        />
        <div className="relative mx-auto flex w-full max-w-[1400px] items-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="hero-glass relative z-30 w-full max-w-[640px] rounded-[28px] p-6 sm:rounded-[36px] sm:p-9 md:max-w-[500px] lg:max-w-[640px] lg:p-10">
            <p className="font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[18px]">
              Sukkos 5787 · Nationwide Mivtza
            </p>
            <h1 className="mt-4 font-display text-[26px] font-black uppercase leading-[1.15] text-white sm:text-[34px] lg:text-[38px]">
              Every soldier.<br />Every Lulav.<br /><span className="text-gold">One giant mission.</span>
            </h1>
            <p className="mt-5 font-display text-[17px] leading-[1.35] text-white sm:text-[20px] lg:text-[22px]">
              Tzivos Hashem soldiers are hitting the streets to help every Yid shake the Lulav and Esrog.
              Pick your school, watch the count climb, and join the mivtza!
            </p>
            {/* two equal-width pills, as in the comp */}
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-7 sm:gap-4">
              <Button to="/login" variant="navy" className="sm:min-w-[250px] sm:text-[21px]">I'm a Soldier — Log Shakes</Button>
              <button
                type="button"
                onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn btn-gold sm:min-w-[250px] sm:text-[21px]"
              >
                See the Campaigns
              </button>
            </div>
          </div>
          <img
            src={asset('design/hero-boy.png')}
            alt=""
            draggable="false"
            className="pointer-events-none absolute -bottom-6 right-4 z-20 hidden h-[500px] w-auto select-none md:block lg:right-8 lg:h-[580px] xl:right-12 xl:h-[624px]"
          />
        </div>
      </section>

      {/* Nationwide goal + global stats — pulled up over the hero's bottom edge */}
      {stats && (
        <section className="relative z-10 mx-auto -mt-6 max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <Card className="rounded-[32px] p-6 pt-8 sm:rounded-[40px] sm:p-10 lg:px-14 lg:pb-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* lulav-icon.png is a mis-export (traffic light); the 12x45 small render is the correct subject and never upscaled here */}
              <Eyebrow icon={asset('design/lulav-esrog-small.png')} iconClass="h-6 sm:h-7">One Giant Mission · Nationwide</Eyebrow>
              {goalReached && <Pill className="!bg-green !text-white">🎉 Goal reached!</Pill>}
            </div>

            {/* labels + big numbers; kept above the lulav marker in the stacking order */}
            <div className="relative z-10 mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 sm:mt-5 sm:gap-x-12">
              <div>
                <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Goal</p>
                <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[40px] lg:text-[44px]">{fmt(stats.totalGoal)}</p>
              </div>
              <div>
                <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Total Shakes</p>
                <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-green sm:text-[40px] lg:text-[44px]">{fmt(stats.totalShakes)}</p>
              </div>
              {/* sky halo (stroke painted under the fill) so the digits stay legible when the lulav marker rises behind them at high percentages */}
              <p className="ml-auto font-display text-[30px] font-black leading-none tabular-nums text-green [paint-order:stroke_fill] [-webkit-text-stroke:8px_var(--color-sky)] sm:text-[40px] lg:text-[44px]">{percent}%</p>
            </div>

            {/* Right gutter (mr-*) per breakpoint = the widest percent label ("100%": 79 / 105 / 116px)
                + half the marker (9 / 13 / 15px) + a ~24px gap, so the lulav standing on the fill's end
                can never cross the label; at 100% it stands just left of it. Sized from the label's font
                size at each breakpoint, so it holds at any viewport width. */}
            <GoalBar percent={percent} className="mt-5 mr-[112px] sm:mt-6 sm:mr-[144px] lg:mr-[156px]" />

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:mt-10 lg:gap-8">
              <Stat icon={asset('design/icon-soldier-hat.png')} value={fmt(stats.activeSoldiers)} label="Soldiers" />
              <Stat icon={asset('design/icon-school.png')} value={fmt(stats.totalSchools)} label="Schools" />
              <Stat icon={asset('design/icon-camera.png')} value={fmt(stats.totalPhotos)} label="Field Photos" />
            </div>
          </Card>
        </section>
      )}

      {schools && schools.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 sm:pt-12 lg:px-10"><SchoolsRace schools={schools} /></section>
      )}

      <section id="schools" className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
        <div className="mb-6">
          <Eyebrow>Join a Campaign</Eyebrow>
          <h2 className="mt-1.5 font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">School Campaigns</h2>
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
