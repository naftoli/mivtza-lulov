import { useState } from 'react'
import { fmt } from '../lib/format.js'
import { Card, SectionHeader } from './ui.jsx'
import { RankBadge } from './Leaderboard.jsx'

// Race-bar fills — one per rank in the comp's order (cycles past five), each a
// light -> full -> deep gradient of the race palette; the same fills Home's
// race card uses, so both pages read as one system.
const RACE_FILLS = [
  'linear-gradient(90deg, #8fd89d 0%, var(--color-race-green) 45%, #3f9a55 100%)',
  'linear-gradient(90deg, #fde58f 0%, var(--color-race-yellow) 55%, #f0b929 100%)',
  'linear-gradient(90deg, #86a8db 0%, var(--color-race-blue) 55%, #2f5fa6 100%)',
  'linear-gradient(90deg, #f6a09a 0%, var(--color-race-red) 55%, #d9463f 100%)',
  'linear-gradient(90deg, #6fd0c3 0%, var(--color-race-teal) 55%, #0b8a7e 100%)',
]

// Class/platoon standings — each class races toward its own goal (kids × 5).
// `color` still drives the percent figure (defaults to green-deep).
export default function ClassLeaderboard({ rows, highlightGrade, color = 'var(--color-green)' }) {
  const [sort, setSort] = useState('percent')
  const ranked = [...rows].sort((a, b) => (sort === 'percent' ? b.percent - a.percent : b.count - a.count))
  // Same green pill toggle as Home's race — the active segment shades sky -> teal-green.
  const seg = (active) =>
    `rounded-full px-3.5 py-2 text-green transition ${active ? 'shadow-sm' : 'hover:bg-white/15'}`
  const segStyle = (active) => (active ? { background: 'linear-gradient(90deg, #a6e0f6 0%, #6db58d 45%, #549182 100%)' } : undefined)
  return (
    <Card className="p-5 sm:p-6" topColor="var(--color-green)">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionHeader>Platoon Leaderboard</SectionHeader>
        <div className="inline-flex rounded-full bg-[#69c07c] p-1 font-cond text-[13px] uppercase leading-none tracking-[0.04em] sm:text-[15px]">
          <button type="button" onClick={() => setSort('percent')} className={seg(sort === 'percent')} style={segStyle(sort === 'percent')}>% of goal</button>
          <button type="button" onClick={() => setSort('total')} className={seg(sort === 'total')} style={segStyle(sort === 'total')}>Total shakes</button>
        </div>
      </div>
      {ranked.length === 0 ? (
        <p className="py-6 text-center text-sm text-navy/70">No classes ranked yet.</p>
      ) : (
        <ol className="space-y-3">
          {ranked.map((r, i) => (
            <li key={r.grade} className={`rounded-2xl px-2 py-1.5 ${r.grade === highlightGrade ? 'bg-white/55 ring-1 ring-green-mid' : ''}`}>
              <div className="flex items-center gap-3">
                <RankBadge index={i} />
                <span className="flex-1 truncate text-[15px] font-semibold text-navy">Grade {r.grade}</span>
                <span className="text-xs font-semibold tabular-nums text-navy/60">{fmt(r.count)} / {fmt(r.goal)}</span>
                <span className="w-10 text-right font-display text-sm font-bold tabular-nums" style={{ color }}>{r.percent}%</span>
              </div>
              <div className="ml-11 mt-1.5 h-2.5 overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(r.percent, 3)}%`, background: RACE_FILLS[i % RACE_FILLS.length] }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
