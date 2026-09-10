import { useEffect, useId, useRef, useState } from 'react'
import { fmt } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { Pill } from './ui.jsx'

// Thick angular "campaign" line that climbs with a couple of bends to a stub
// arrowhead — with a gradient, glow, milestone markers, a pulsing progress dot,
// and a sparkle at the goal.
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
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f6c945" /><stop offset="1" stopColor="#ef8a2c" />
        </linearGradient>
        <marker id={arrId} markerUnits="userSpaceOnUse" markerWidth="26" markerHeight="26" refX="7" refY="13" orient="auto">
          <path d="M1,2 L24,13 L1,24 Z" fill="var(--color-line)" />
        </marker>
        <filter id={glowId} x="-30%" y="-40%" width="160%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#ef8a2c" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* faint track + stub arrowhead */}
      <path ref={pathRef} d={d} fill="none" stroke="var(--color-track)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrId})`} />

      {/* milestone markers on the track */}
      {pts?.ms.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.6" fill="#fff" stroke="var(--color-line)" strokeWidth="2" />
      ))}

      {/* progress line — gradient + glow, revealed to percent */}
      <path d={d} pathLength="100" fill="none" stroke={`url(#${gradId})`} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="100" strokeDashoffset={100 - p} filter={`url(#${glowId})`} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />

      {/* pulsing "you are here" dot */}
      {pts && (
        <g>
          <circle cx={pts.prog[0]} cy={pts.prog[1]} r="7" fill="none" stroke="#ef8a2c" strokeWidth="2" opacity="0.7">
            <animate attributeName="r" values="7;16;7" dur="1.9s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="1.9s" repeatCount="indefinite" />
          </circle>
          <circle cx={pts.prog[0]} cy={pts.prog[1]} r="7" fill="#fff" />
          <circle cx={pts.prog[0]} cy={pts.prog[1]} r="4.5" fill="#ef8a2c" />
        </g>
      )}

      {/* sparkles at the goal */}
      {sparkleAtTip ? (
        pts?.tip && (
          <g fill="#f6c945">
            <path d={star(pts.tip[0] + 6, pts.tip[1] - 3, 6)} />
            <path d={star(pts.tip[0] - 7, pts.tip[1] - 10, 3.4)} opacity="0.85" />
          </g>
        )
      ) : (
        <g fill="#f6c945">
          <path d={star(306, 12, 6)} />
          <path d={star(287, 20, 3.4)} opacity="0.85" />
        </g>
      )}
    </svg>
  )
}

export default function GoalMeter({ school, celebrateMilestones = true, variant = 'default', actions = null, centerAction = null }) {
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

  // Experimental "wide" layout: the arrow spans the whole card, with the shake
  // count in the top-left corner and the goal/percent in the bottom-right —
  // the two empty corners the diagonal arrow leaves.
  if (variant === 'wide') {
    return (
      <div className="relative mx-auto w-full max-w-[560px]">
        <GoalTrend percent={percent} d={SCHOOL_TREND} sparkleAtTip />
        <div className="pointer-events-none absolute inset-0">
          {/* count — top left */}
          <div className="absolute -left-8 -top-2 text-left">
            <p className="flex items-baseline gap-2">
              <span className="text-3xl">🌿</span>
              <span className="bg-gradient-to-br from-[#f6c945] to-[#ef8a2c] bg-clip-text pb-2 pr-1.5 font-display text-6xl font-bold leading-[1.15] tabular-nums text-transparent">
                {fmt(total)}
              </span>
            </p>
            <p className="mt-1 font-cond text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Total Shakes
            </p>
          </div>
          {/* goal — standing panel overlaying the arrow */}
          <div className="pointer-events-none absolute bottom-[5%] -right-6 rounded-lg border border-line bg-card/90 px-3 py-6 text-center shadow-md backdrop-blur-sm">
            <p className="font-display text-2xl font-bold leading-none tabular-nums text-navy">{percentOfBase ?? percent}%</p>
            <p className="mt-1.5 font-cond text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">of goal · {fmt(goal)}</p>
            {bonusActive ? (
              <div className="mt-3 border-t border-line pt-2.5">
                <p className="font-cond text-[9px] font-semibold uppercase tracking-[0.12em] text-gold-dark">Bonus · {fmt(bonusGoal)}</p>
              </div>
            ) : goalReached ? (
              <p className="mt-2 font-cond text-[9px] font-semibold uppercase tracking-[0.12em] text-green">🎉 Goal reached!</p>
            ) : null}
          </div>
          {/* share — back in the valley, lower-left */}
          {actions && (
            <div className="pointer-events-auto absolute bottom-[13%] left-[30%]">{actions}</div>
          )}
          {/* primary action — up in the open pocket, centered */}
          {centerAction && (
            <div className="pointer-events-auto absolute left-[59%] top-[33%] -translate-x-1/2 -translate-y-1/2">{centerAction}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="w-full max-w-[460px] flex-1"><GoalTrend percent={percent} /></div>

      <div className="flex-none text-center sm:text-right">
        <p className="font-cond text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {bonusActive ? `Bonus Round ×${bonusLevel}` : 'Total Shakes'}
        </p>

        <p className="mt-1 flex items-baseline justify-center gap-2 sm:justify-end">
          <span className="text-3xl">🌿</span>
          <span className="bg-gradient-to-br from-[#f6c945] to-[#ef8a2c] bg-clip-text pb-2 pr-1.5 font-display text-6xl font-bold leading-[1.15] tabular-nums text-transparent">
            {fmt(total)}
          </span>
        </p>

        <p className="mt-3 font-cond text-sm font-semibold uppercase tracking-[0.1em] text-muted">
          {percentOfBase ?? percent}% of goal · {fmt(goal)} shakes
        </p>
        {bonusActive ? (
          <p className="font-cond text-sm font-semibold uppercase tracking-[0.1em] text-gold-dark">
            Bonus goal · {fmt(bonusGoal)} shakes
          </p>
        ) : goalReached ? (
          <Pill className="mt-2 !bg-green/15 !text-green">🎉 Goal reached!</Pill>
        ) : null}
      </div>
    </div>
  )
}
