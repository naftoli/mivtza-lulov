import { useEffect, useId, useRef, useState } from 'react'
import { fmt } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { LulavIcon } from './ui.jsx'

// Thick angular "campaign" line that climbs with a couple of bends to a stub
// arrowhead — with a gradient, glow, milestone markers, a pulsing progress dot,
// and a sparkle at the goal.
//
// 2026 redesign: this is a RESKIN only. The path geometry, viewBox, stroke
// widths and every overlay offset in the wide variant are client-tuned and
// must stay exactly as they are — only colours and type changed (arrow now
// runs gold -> green-mid over the sky track, navy-tinted arrowhead, gold
// sparkles, green-deep progress dot).
const TREND = 'M14,128 L120,80 L208,90 L300,28'
// School (wide) variant: same shoulders, but the middle segment is dead level
// (both points at the same height) instead of tilting.
const SCHOOL_TREND = 'M14,128 L120,80 L208,80 L300,28'

function GoalTrend({ percent, d = TREND, sparkleAtTip = false }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradId = `g-${raw}`; const arrId = `a-${raw}`; const glowId = `s-${raw}`
  const p = Math.max(0, Math.min(100, percent))
  const pathRef = useRef(null)
  const [pts, setPts] = useState(null)

  useEffect(() => {
    const path = pathRef.current
    if (!path) return
    const L = path.getTotalLength()
    const at = (f) => { const q = path.getPointAtLength(L * Math.max(0, Math.min(1, f))); return [q.x, q.y] }
    // Arrowhead tip = path end pushed a little further along its final direction,
    // so decorations placed relative to it always ride with the arrow.
    const end = at(1), near = at(0.97)
    const dx = end[0] - near[0], dy = end[1] - near[1]
    const len = Math.hypot(dx, dy) || 1
    const tip = [end[0] + (dx / len) * 14, end[1] + (dy / len) * 14]
    setPts({ ms: [0.25, 0.5, 0.75].map(at), prog: at(p / 100), tip })
  }, [p, d])

  const star = (cx, cy, r) =>
    `M${cx},${cy - r} L${cx + r * 0.28},${cy - r * 0.28} L${cx + r},${cy} L${cx + r * 0.28},${cy + r * 0.28} L${cx},${cy + r} L${cx - r * 0.28},${cy + r * 0.28} L${cx - r},${cy} L${cx - r * 0.28},${cy - r * 0.28} Z`

  return (
    <svg viewBox="-14 -6 346 158" className="h-auto w-full" role="img" aria-label={`${p}% of goal`}>
      <defs>
        {/* arrow fill: gold -> green-mid (the --grad-arrow pair, as SVG stops) */}
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--color-gold)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-green-mid)' }} />
        </linearGradient>
        <marker id={arrId} markerUnits="userSpaceOnUse" markerWidth="26" markerHeight="26" refX="7" refY="13" orient="auto">
          {/* navy-tinted stub arrowhead over the sky card */}
          <path d="M1,2 L24,13 L1,24 Z" fill="var(--color-navy)" fillOpacity="0.38" />
        </marker>
        <filter id={glowId} x="-30%" y="-40%" width="160%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" style={{ floodColor: 'var(--color-green)' }} floodOpacity="0.28" />
        </filter>
      </defs>

      {/* faint track + stub arrowhead */}
      <path ref={pathRef} d={d} fill="none" stroke="var(--color-track)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrId})`} />

      {/* milestone markers on the track */}
      {pts?.ms.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.6" fill="#fff" stroke="var(--color-navy)" strokeOpacity="0.35" strokeWidth="2" />
      ))}

      {/* progress line — gradient + glow, revealed to percent */}
      <path d={d} pathLength="100" fill="none" stroke={`url(#${gradId})`} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="100" strokeDashoffset={100 - p} filter={`url(#${glowId})`} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />

      {/* pulsing "you are here" dot */}
      {pts && (
        <g>
          <circle cx={pts.prog[0]} cy={pts.prog[1]} r="7" fill="none" stroke="var(--color-green-mid)" strokeWidth="2" opacity="0.7">
            <animate attributeName="r" values="7;16;7" dur="1.9s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="1.9s" repeatCount="indefinite" />
          </circle>
          <circle cx={pts.prog[0]} cy={pts.prog[1]} r="7" fill="#fff" />
          <circle cx={pts.prog[0]} cy={pts.prog[1]} r="4.5" fill="var(--color-green)" />
        </g>
      )}

      {/* sparkles at the goal — gold */}
      {sparkleAtTip ? (
        pts?.tip && (
          <g fill="var(--color-gold)">
            <path d={star(pts.tip[0] + 6, pts.tip[1] - 3, 6)} />
            <path d={star(pts.tip[0] - 7, pts.tip[1] - 10, 3.4)} opacity="0.85" />
          </g>
        )
      ) : (
        <g fill="var(--color-gold)">
          <path d={star(306, 12, 6)} />
          <path d={star(287, 20, 3.4)} opacity="0.85" />
        </g>
      )}
    </svg>
  )
}

export default function GoalMeter({ school, celebrateMilestones = true, variant = 'default' }) {
  const { total, percent, percentOfBase, goalReached, bonusActive, bonusLevel, goal, bonusGoal } = school
  const prevPercent = useRef(percent)
  const prevReached = useRef(goalReached)

  useEffect(() => {
    if (celebrateMilestones) {
      if (!prevReached.current && goalReached) celebrate(1.8)
      else {
        const crossed = [25, 50, 75].find((m) => prevPercent.current < m && percent >= m)
        if (crossed) celebrate(1)
      }
    }
    prevPercent.current = percent
    prevReached.current = goalReached
  }, [percent, goalReached, celebrateMilestones])

  // "Wide" layout (school campaign card): the arrow spans the whole card, with
  // the shake count in the top-left corner and the goal/percent in the
  // bottom-right — the two empty corners the diagonal arrow leaves.
  // Every offset in the sm-and-up overlay is client-tuned — do not move anything.
  if (variant === 'wide') {
    // Shared by both layouts below so the phone flow and the desktop overlay
    // can never drift apart.
    const count = (
      <>
        <p className="flex items-baseline gap-2">
          <LulavIcon className="h-[52px]" />
          <span className="pb-2 pr-1.5 font-display text-6xl font-black leading-[1.15] tabular-nums text-green">
            {fmt(total)}
          </span>
        </p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-navy">
          Total Shakes
        </p>
      </>
    )
    const panel = (
      <>
        <p className="font-display text-2xl font-black leading-none tabular-nums text-green">{percentOfBase ?? percent}%</p>
        <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-navy">of goal · {fmt(goal)}</p>
        {bonusActive && (
          <div className="mt-3 border-t border-navy/10 pt-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-gold-dark">Bonus {bonusLevel} · {fmt(bonusGoal)}</p>
          </div>
        )}
      </>
    )
    return (
      <div className="relative mx-auto w-full max-w-[560px]">
        {/* phones (below sm): stacked flow — count, arrow, then the % panel.
            The arrow is only ~135px tall at 375px, so overlays would pile up. */}
        <div className="mb-1 sm:hidden">{count}</div>
        <GoalTrend percent={percent} d={SCHOOL_TREND} sparkleAtTip />
        <div className="mt-3 sm:hidden">
          <div className="inline-block rounded-2xl bg-sky/95 px-3 py-2 text-center shadow-sm ring-1 ring-navy/10">{panel}</div>
        </div>
        {/* sm and up: the overlay composition (client-tuned — keep as is) */}
        <div className="pointer-events-none absolute inset-0 hidden sm:block">
          {/* count — top left */}
          <div className="absolute -left-8 -top-2 text-left">{count}</div>
          {/* goal — standing panel overlaying the arrow */}
          <div className="pointer-events-none absolute bottom-[5%] -right-6 rounded-2xl bg-sky/95 px-3 py-9 text-center shadow-md ring-1 ring-navy/10 backdrop-blur-sm">{panel}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="w-full max-w-[460px] flex-1"><GoalTrend percent={percent} /></div>

      <div className="flex-none text-center sm:text-right">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy">
          {bonusActive ? `Bonus Round ${bonusLevel}` : 'Total Shakes'}
        </p>

        <p className="mt-1 flex items-baseline justify-center gap-2 sm:justify-end">
          <LulavIcon className="h-[52px]" />
          <span className="pb-2 pr-1.5 font-display text-6xl font-black leading-[1.15] tabular-nums text-green">
            {fmt(total)}
          </span>
        </p>

        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-navy">
          {percentOfBase ?? percent}% of goal · {fmt(goal)} shakes
        </p>
        {bonusActive && (
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gold-dark">
            Round {bonusLevel} goal · {fmt(bonusGoal)} shakes
          </p>
        )}
      </div>
    </div>
  )
}
