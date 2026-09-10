import { useEffect, useId, useRef } from 'react'
import { fmt } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { Pill } from './ui.jsx'

// A rising "trend line" that climbs toward the goal and reveals up to `percent`.
const TREND = 'M12,150 L104,104 L150,96 L214,60 L300,16'

function GoalTrend({ percent, width = 300 }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradId = `g-${raw}`
  const arrId = `a-${raw}`
  const p = Math.max(0, Math.min(100, percent))

  return (
    <svg viewBox="0 0 312 168" width={width} className="max-w-full flex-none" role="img" aria-label={`${p}% of goal`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f6c945" />
          <stop offset="1" stopColor="#ef8a2c" />
        </linearGradient>
        <marker id={arrId} markerWidth="5" markerHeight="5" refX="2.6" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#ef8a2c" />
        </marker>
      </defs>
      {/* faint full trajectory with the goal arrowhead at the top */}
      <path d={TREND} fill="none" stroke="var(--color-track)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrId})`} />
      {/* progress, revealed up to percent */}
      <path d={TREND} pathLength="100" fill="none" stroke={`url(#${gradId})`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="100" strokeDashoffset={100 - p} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
    </svg>
  )
}

export default function GoalMeter({ school, celebrateMilestones = true }) {
  const { total, activeGoal, percent, goalReached, bonusActive, goal, bonusGoal } = school
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

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      {/* numbers */}
      <div className="min-w-0 flex-1">
        <div className="flex items-end gap-6">
          <div>
            <p className="font-cond text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Goal{bonusActive ? ' (Bonus)' : ''}
            </p>
            <p className="font-display text-2xl font-medium tabular-nums text-muted/80">{fmt(activeGoal)}</p>
          </div>
          <div>
            <p className="font-cond text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Total Shakes</p>
            <p className="bg-gradient-to-br from-[#f6c945] to-[#ef8a2c] bg-clip-text font-display text-5xl font-bold leading-none tabular-nums text-transparent">
              {fmt(total)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-cond text-lg font-bold text-[#e6941f]">{school.percentOfBase ?? percent}% of goal</span>
          {bonusActive ? (
            <Pill className="!bg-gold/20 !text-gold-dark">⭐ Bonus round active</Pill>
          ) : goalReached ? (
            <Pill className="!bg-green/15 !text-green">🎉 Goal reached!</Pill>
          ) : null}
        </div>

        {bonusActive && (
          <p className="mt-2 text-sm text-muted">
            Base goal of <strong className="text-navy">{fmt(goal)}</strong> smashed — now reaching for <strong className="text-navy">{fmt(bonusGoal)}</strong>! 🚀
          </p>
        )}
      </div>

      {/* trend arrow */}
      <GoalTrend percent={percent} width={280} />
    </div>
  )
}
