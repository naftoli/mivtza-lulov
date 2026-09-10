import { fmt } from '../lib/format.js'
import { Card, SectionHeader } from './ui.jsx'

const medals = ['🥇', '🥈', '🥉']

// Class/platoon standings — each class races toward its own goal (kids × 5).
export default function ClassLeaderboard({ rows, highlightGrade, color = 'var(--color-green)' }) {
  return (
    <Card className="p-5" topColor="var(--color-green)">
      <SectionHeader className="mb-1">Class Standings</SectionHeader>
      <p className="mb-4 font-cond text-[11px] uppercase tracking-[0.1em] text-muted/70">Each class vs. its own goal (5 per soldier)</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No classes ranked yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.grade} className={`rounded-lg px-2 py-1.5 ${r.grade === highlightGrade ? 'bg-green/10 ring-1 ring-green/30' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-cond text-sm font-bold text-navy">{medals[i] || i + 1}</span>
                <span className="flex-1 truncate text-[15px] font-semibold text-navy">Grade {r.grade}</span>
                <span className="font-cond text-xs tabular-nums text-muted">{fmt(r.count)} / {fmt(r.goal)}</span>
                <span className="w-10 text-right font-cond text-sm font-bold tabular-nums" style={{ color }}>{r.percent}%</span>
              </div>
              <div className="ml-9 mt-1 h-2 overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(r.percent, 3)}%`, background: color }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
