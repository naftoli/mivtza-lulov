import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getSchools, getGlobalStats, goalPercent } from '../services/api.js'
import { useLiveData } from '../lib/useLiveData.js'
import { fmt, shortSchoolName } from '../lib/format.js'
import { CAMPAIGN_YEAR } from '../lib/succos.js'
import { asset } from '../lib/asset.js'
import { Button, Card, Spinner, Pill, SchoolLogo, Input, ErrorNote } from '../components/ui.jsx'
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
  const [visible, setVisible] = useState(10)
  const ranked = [...schools].sort((a, b) => (sort === 'percent' ? b.percent - a.percent : b.total - a.total))
  const shown = ranked.slice(0, visible)
  // Toggle: green pill, the active segment darker (spec: #549182 vs #69c07c) — in the
  // comp it shades sky -> teal-green from left to right. Condensed caps, green-deep text.
  // From 2xl the toggle is the comp's 215x30 pill: 20px caps in 3px + 2px of padding.
  const seg = (active) =>
    `rounded-full px-3.5 py-2 text-green transition sm:px-5 2xl:px-2.5 2xl:py-0.5 ${active ? 'shadow-sm' : 'hover:bg-white/15'}`
  const segStyle = (active) => (active ? { background: 'linear-gradient(90deg, #a6e0f6 0%, #6db58d 45%, #549182 100%)' } : undefined)
  return (
    // 2xl: the comp's 1408x650 race card — padding 46/36 top/bottom, 63 at the sides — with rows on a
    // 95px pitch (60px medal rows + 15px gaps) whose first centre lands at y~1300 on the comp's canvas.
    <Card className="rounded-[32px] p-5 sm:rounded-[40px] sm:p-10 lg:px-14 2xl:px-[63px] 2xl:pb-[30px] 2xl:pt-[46px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-7 2xl:mb-3 2xl:items-center">
        <div className="min-w-0">
          <Eyebrow icon={asset('design/flag.png')} iconClass="h-[22px] 2xl:h-6">The Race</Eyebrow>
          <h2 className="mt-1.5 font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px] 2xl:text-[36px]">Schools going head to head</h2>
        </div>
        <div className="inline-flex rounded-full bg-[#69c07c] p-1 font-cond text-[15px] uppercase leading-none tracking-[0.04em] sm:text-[17px] 2xl:p-[3px] 2xl:text-[20px]">
          <button type="button" onClick={() => setSort('percent')} className={seg(sort === 'percent')} style={segStyle(sort === 'percent')}>% of goal</button>
          <button type="button" onClick={() => setSort('total')} className={seg(sort === 'total')} style={segStyle(sort === 'total')}>Total shakes</button>
        </div>
      </div>

      {/* 2xl row: medal slot 52 · logo 48 · name 235 · bar (fills the rest = 752 in the 1282px inner
          width) · percent 91, with 26px gaps; the row's own 12px side padding is pulled outside the
          card's inner edge so the medal sits flush with it while the hover wash keeps its inset. */}
      <div className="space-y-2 sm:space-y-3 2xl:space-y-[15px]">
        {shown.map((s, i) => (
          <Link
            key={s.id}
            to={`/s/${s.id}`}
            className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl px-2 py-2.5 transition hover:bg-white/40 sm:flex sm:gap-4 sm:px-3 lg:gap-5 2xl:-mx-3 2xl:gap-[26px]"
          >
            {/* the slot keeps the medal's 60px height from 2xl so numeral rows (ranks 4+) hold the same pitch */}
            <span className="grid w-9 flex-none place-items-center sm:w-12 lg:w-14 2xl:h-[60px] 2xl:w-[52px]">
              {i < 3 && s.total > 0
                ? <img src={asset(`design/${MEDALS[i]}.png`)} alt={`#${i + 1}`} draggable="false" className="h-9 w-auto sm:h-[46px] lg:h-[52px] 2xl:h-[60px]" />
                : <span className="font-display text-[20px] font-bold italic leading-none text-blue-accent sm:text-[24px]">{i + 1}</span>}
            </span>
            <SchoolLogo school={s} size={44} className="2xl:!h-12 2xl:!w-12" />
            <span className="min-w-0 truncate font-display text-[17px] font-semibold text-navy sm:w-40 sm:flex-none sm:text-[19px] lg:w-56 lg:text-[20px] xl:w-64 2xl:w-[235px] 2xl:text-[22px]">{s.name}</span>
            <span className="relative col-span-4 h-4 overflow-hidden rounded-full bg-track sm:order-none sm:col-span-1 sm:h-5 sm:flex-1 order-last 2xl:h-[22px]">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.max(s.percent, 3))}%`, background: RACE_FILLS[i % RACE_FILLS.length] }}
              />
            </span>
            <span className="text-right font-display text-[16px] font-bold tabular-nums text-green sm:w-16 sm:flex-none sm:text-[18px] lg:w-24 lg:text-[20px] 2xl:w-[91px] 2xl:text-[26px]">
              {sort === 'percent' ? `${s.percent}%` : fmt(s.total)}
            </span>
          </Link>
        ))}
      </div>

      {ranked.length > visible && (
        <div className="mt-6 flex justify-center 2xl:mt-4">
          <Button variant="outline" onClick={() => setVisible((v) => v + 10)}>View more</Button>
        </div>
      )}
    </Card>
  )
}

function SchoolCard({ s }) {
  return (
    <Link to={`/s/${s.id}`} className="group block">
      <Card className="h-full transition group-hover:-translate-y-[3px] group-hover:shadow-hover">
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
            <span className="text-sm font-semibold text-muted">of {fmt(s.goal)} shakes</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(s.percent, 3))}%`, background: s.color }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[13px] font-semibold uppercase tracking-[0.04em]">
            <span className="text-green">{s.percent}% there</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export default function Home() {
  const { data: schools, loading, error, reload } = useLiveData(() => getSchools(), [])
  const { data: stats, error: statsError, reload: reloadStats } = useLiveData(() => getGlobalStats(), [])
  const [query, setQuery] = useState('')

  const percent = stats ? goalPercent(stats.totalShakes, Math.max(1, stats.totalGoal)) : 0
  const goalReached = !!stats && stats.totalShakes >= stats.totalGoal

  const q = query.trim().toLowerCase()
  const filteredSchools = (schools || []).filter(
    (s) => !q || s.name.toLowerCase().includes(q) || shortSchoolName(s).toLowerCase().includes(q),
  )

  return (
    <div>
      {/* Hero — full-bleed city photo, green glass panel left, soldier cutout right.
          `isolate` keeps the panel/boy z-order inside the hero, so the nationwide
          card (z-10, pulled up over the hero) paints over the boy's feet as in the comp. */}
      {/* 2xl (>= 1536px) is the comp's geometry on a 1920 canvas: hero 636 tall; the 1552px container
          with a 16px gutter puts the glass panel's left edge at x=200; the panel (650 wide, ~410 tall)
          sits on the hero's bottom edge with a 70px gap, so its top lands at y~255 under the 100px header. */}
      <section className="relative isolate flex min-h-[430px] sm:min-h-[520px] md:min-h-[600px] 2xl:min-h-[636px]">
        <img
          src={asset('design/hero-city.jpg')}
          alt=""
          draggable="false"
          className="absolute inset-0 h-full w-full select-none object-cover object-[62%_center]"
        />
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-row items-center gap-2 px-4 py-8 sm:gap-4 sm:px-6 sm:py-10 lg:gap-0 lg:px-10 2xl:max-w-[1552px] 2xl:items-end 2xl:px-4 2xl:pb-[70px]">
          {/* 2xl rhythm is the comp's, measured on its canvas: eyebrow caps at y 287-301, the H1's three
              cap rows at 347 / 392 / 434 (Exo Black 36px — "ONE GIANT MISSION." is 353px wide in the
              comp, which 36px reproduces and 42px overshoots by 60px — on a 1.2 pitch), body lines on a
              29px pitch from y 500, pills at y 603-641, panel bottom at 666. */}
          <div className="hero-glass relative z-30 min-w-0 max-w-[68%] flex-1 rounded-[22px] p-4 sm:max-w-[66%] sm:rounded-[36px] sm:p-7 md:max-w-[60%] lg:w-full lg:max-w-[520px] lg:flex-none lg:p-10 xl:max-w-[640px] 2xl:max-w-[650px] 2xl:rounded-[40px] 2xl:px-10 2xl:pb-[25px] 2xl:pt-8">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-[15px] lg:text-[18px]">
              Sukkos {CAMPAIGN_YEAR} · Worldwide Mivtza
            </p>
            <h1 className="mt-2 font-display text-[19px] font-black uppercase leading-[1.15] text-white sm:mt-4 sm:text-[30px] lg:text-[38px] 2xl:mt-[30px] 2xl:text-[36px] 2xl:leading-[1.2]">
              Every soldier.<br />Every <span className="text-gold">Shake.</span>
            </h1>
            <p className="mt-2.5 font-display text-[12px] leading-[1.35] text-white sm:mt-5 sm:text-[18px] lg:text-[22px] 2xl:mt-7 2xl:text-[24px] 2xl:leading-[1.2]">
              Tzivos Hashem soldiers are hitting the streets to help every Yid shake the Lulav and Esrog.
              Join the Mivtza today!
            </p>
            {/* two equal-width pills, as in the comp — 225x38 from 2xl (20px condensed caps is the
                largest Bebas size whose longest label still fits that width with 16px sides) */}
            <div className="mt-4 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-4 2xl:mt-5 2xl:gap-5">
              <Button to="/login" variant="navy" className="w-full px-3 py-2 text-[12px] sm:w-auto sm:px-6 sm:py-3 sm:min-w-[250px] sm:text-[21px] 2xl:min-w-[225px] 2xl:px-4 2xl:py-2 2xl:text-[22px] 2xl:tracking-normal">I'm a Soldier — Log Shakes</Button>
              <button
                type="button"
                onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn btn-gold w-full px-3 py-2 text-[12px] sm:w-auto sm:px-6 sm:py-3 sm:min-w-[250px] sm:text-[21px] 2xl:min-w-[225px] 2xl:px-4 2xl:py-2 2xl:text-[22px] 2xl:tracking-normal"
              >
                See the Campaigns
              </button>
            </div>
          </div>
          {/* Phones/tablets: same side-by-side arrangement as the desktop comp — panel left, cutout
              right — at a reduced height, with the nationwide card below still overlapping his feet. */}
          <img
            src={asset('design/hero-boy.png')}
            alt=""
            draggable="false"
            className="pointer-events-none absolute bottom-0 right-0 z-20 h-[290px] w-auto max-w-none select-none sm:right-2 sm:h-[400px] lg:hidden"
          />
          {/* Top-anchored with its height tied to the hero so the PNG's flat top crop stays under the
              header. From 2xl the comp places the cutout at exactly the hero's height (470x636, x 1170-1640
              on a 1920 canvas): right edge 96px in from the container's padding box (184..1736), and its
              bottom already runs 26px under the nationwide card's top edge. */}
          <img
            src={asset('design/hero-boy.png')}
            alt=""
            draggable="false"
            className="pointer-events-none absolute right-6 top-0 z-20 hidden h-[calc(100%_+_24px)] w-auto select-none lg:block xl:right-12 2xl:right-[96px] 2xl:h-full"
          />
        </div>
      </section>

      {/* Nationwide goal + global stats — pulled up over the hero's bottom edge.
          From 2xl the card is the comp's 1408x380 at x 292-1700 (1512px container, 88px left / 16px right gutter), radius 40,
          overlapping the hero by 26px, padded 44/50 top/bottom and 63 at the sides; the row spacing
          below puts the labels at y~805, the 56px numbers' baseline at y~880, the bar at y 905-929 and the
          stat tiles at y 955-1039 on the comp's canvas. */}
      {!stats && statsError && (
        <section className="relative z-10 mx-auto -mt-6 max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <ErrorNote error={statsError} onRetry={reloadStats} what="the nationwide totals" />
        </section>
      )}
      {stats && (
        <section className="relative z-10 mx-auto -mt-6 max-w-[1400px] px-4 sm:px-6 lg:px-10 2xl:-mt-[26px] 2xl:max-w-[1512px] 2xl:pl-[88px] 2xl:pr-4">
          <Card className="rounded-[32px] p-6 pt-8 sm:rounded-[40px] sm:p-10 lg:px-14 lg:pb-12 2xl:px-[63px] 2xl:pb-[53px] 2xl:pt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* lulav-icon.png is a mis-export (traffic light); the 12x45 small render is the correct subject and never upscaled here */}
              <Eyebrow icon={asset('design/lulav-esrog-small.png')} iconClass="h-6 sm:h-7">Mivtza Lulov {CAMPAIGN_YEAR}</Eyebrow>
              {goalReached && <Pill className="!bg-green !text-white">🎉 Goal reached!</Pill>}
            </div>

            {/* labels + big numbers; kept above the lulav marker in the stacking order */}
            <div className="relative z-10 mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 sm:mt-5 sm:gap-x-12 2xl:mt-[18px] 2xl:gap-x-[40px]">
              <div>
                <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Goal</p>
                <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-navy sm:text-[40px] lg:text-[44px] 2xl:mt-[18px] 2xl:text-[56px]">{fmt(stats.totalGoal)}</p>
              </div>
              <div>
                <p className="font-display text-[15px] font-semibold uppercase leading-none text-navy sm:text-[18px]">Total Shakes</p>
                <p className="mt-2 font-display text-[30px] font-black leading-none tabular-nums text-green sm:text-[40px] lg:text-[44px] 2xl:mt-[18px] 2xl:text-[56px]">{fmt(stats.totalShakes)}</p>
              </div>
              {/* sm+: percent lives up here beside the numbers; on phones it moves inline with the bar (below). */}
              <p className="ml-auto hidden font-display text-[30px] font-black leading-none tabular-nums text-green [paint-order:stroke_fill] [-webkit-text-stroke:8px_var(--color-sky)] sm:block sm:text-[40px] lg:text-[44px] 2xl:text-[56px]">{percent}%</p>
            </div>

            {/* Right gutter (mr-*) per breakpoint = the widest percent label ("100%": 79 / 105 / 116px)
                + half the marker (9 / 13 / 15px) + a ~24px gap, so the lulav standing on the fill's end
                can never cross the label; at 100% it stands just left of it. Sized from the label's font
                size at each breakpoint, so it holds at any viewport width. From 2xl the bar runs the card's
                full inner width as in the comp; the label's sky halo + z-10 keep it legible if the marker
                rises behind it at high percentages. */}
            {/* Phones: bar + percent on one row (no desktop gutter needed — the percent isn't above the bar here).
                sm+ keeps the comp's full-width bar with the per-breakpoint right gutter that clears the marker. */}
            <div className="mt-5 flex items-center gap-3 sm:mt-0 sm:block">
              <GoalBar percent={percent} className="min-w-0 flex-1 sm:mt-6 sm:mr-[144px] lg:mr-[156px] 2xl:mt-[15px] 2xl:mr-[150px]" />
              <span className="flex-none font-display text-[26px] font-black leading-none tabular-nums text-green sm:hidden">{percent}%</span>
            </div>

            {/* From 2xl: three 320px columns from the card's inner left (the 3D icons overhang it by
                10px in the comp), not stretched across the card. */}
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:mt-10 lg:gap-8 2xl:-ml-2.5 2xl:mt-[26px] 2xl:grid-cols-[repeat(3,320px)] 2xl:gap-0">
              <Stat icon={asset('design/icon-soldier-hat.png')} value={fmt(stats.activeSoldiers)} label="Soldiers" />
              <Stat icon={asset('design/icon-school.png')} value={fmt(stats.totalSchools)} label="Schools" />
              <Stat icon={asset('design/icon-camera.png')} value={fmt(stats.totalPhotos)} label="Photos" />
            </div>
          </Card>
        </section>
      )}

      {schools && schools.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6 sm:pt-12 lg:px-10 2xl:max-w-[1512px] 2xl:pl-[88px] 2xl:pr-4 2xl:pt-[45px]"><SchoolsRace schools={schools} /></section>
      )}

      <section id="schools" className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10 2xl:max-w-[1512px] 2xl:pl-[88px] 2xl:pr-4">
        <div className="mb-6">
          <h2 className="font-display text-[24px] font-bold italic leading-tight text-navy sm:text-[30px]">Bases In Action</h2>
        </div>
        {error && !schools ? <ErrorNote error={error} onRetry={reload} what="the schools" />
          : loading || !schools ? <Spinner /> : (
          <>
            <div className="mb-6 max-w-md">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search schools by name…"
                aria-label="Search schools by name"
              />
            </div>
            {filteredSchools.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSchools.map((s) => <SchoolCard key={s.id} s={s} />)}
              </div>
            ) : (
              <p className="font-display text-[16px] italic text-muted">No schools match “{query}”.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
