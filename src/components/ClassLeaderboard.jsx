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
  return (
    <Card className="p-5 sm:p-6" topColor="var(--color-green)">
      <SectionHeader className="mb-1">Class Standings</SectionHeader>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/60">Each class vs. its own goal (5 per soldier)</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-navy/70">No classes ranked yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
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
