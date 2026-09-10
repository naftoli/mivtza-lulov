import { useEffect, useRef } from 'react'
import { fmt } from '../lib/format.js'
import { celebrate } from '../lib/celebrate.js'
import { Pill } from './ui.jsx'

// Big progress "thermometer" for a school campaign.
export default function GoalMeter({ school, celebrateMilestones = true }) {
  const { total, activeGoal, percent, goalReached, bonusActive, goal, bonusGoal, color } = school
  const accent = color || 'var(--color-blue)'
  const prevPercent = useRef(percent)
  const prevReached = useRef(goalReached)

  useEffect(() => {
    if (celebrateMilestones) {
      if (!prevReached.current && goalReached) {
        celebrate(1.8) // actually crossed the goal (not just rounded to 100%)
      } else {
        const crossed = [25, 50, 75].find((m) => prevPercent.current < m && percent >= m)
        if (crossed) celebrate(1)
      }
    }
    prevPercent.current = percent
    prevReached.current = goalReached
  }, [percent, goalReached, celebrateMilestones])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-8">
          <div>
            <p className="font-cond text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted">
              Goal{bonusActive ? ' (Bonus)' : ''}
            </p>
            <p className="font-display text-5xl font-medium tabular-nums text-muted/70">{fmt(activeGoal)}</p>
          </div>
          <div>
            <p className="font-cond text-[11.5px] font-semibold uppercase tracking-[0.16em] text-muted">Total Shakes</p>
            <p className="font-display text-5xl font-medium tabular-nums text-navy">{fmt(total)}</p>
          </div>
        </div>
        <div className="text-right">
          {bonusActive ? (
            <Pill className="!bg-gold/20 !text-gold-dark">⭐ Bonus round active</Pill>
          ) : goalReached ? (
            <Pill className="!bg-green/15 !text-green">🎉 Goal reached!</Pill>
          ) : null}
          <p className="mt-1 font-cond text-2xl font-bold" style={{ color: accent }}>{percent}%</p>
        </div>
      </div>

      {/* bar */}
      <div className="relative mt-4 h-7 w-full overflow-hidden rounded-full bg-track ring-1 ring-line">
        <div
          className="flex h-full items-center justify-end rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${Math.max(percent, 4)}%`, background: `linear-gradient(90deg, ${accent}, ${accent})`, filter: 'saturate(1.05)' }}
        >
          <span className="pr-2 text-sm">🌿</span>
        </div>
        {[25, 50, 75].map((m) => (
          <span key={m} className="absolute top-0 h-full w-px bg-white/60" style={{ left: `${m}%` }} />
        ))}
      </div>

      {bonusActive && (
        <p className="mt-2 text-sm text-muted">
          Base goal of <strong className="text-navy">{fmt(goal)}</strong> smashed — now reaching for <strong className="text-navy">{fmt(bonusGoal)}</strong>! 🚀
        </p>
      )}
    </div>
  )
}
