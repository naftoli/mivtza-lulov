import { fmt } from '../lib/format.js'
import { Card, SectionHeader } from './ui.jsx'

const medals = ['🥇', '🥈', '🥉']

// Class/platoon standings for a school ("which grade is shaking most").
export default function ClassLeaderboard({ rows, highlightGrade }) {
  return (
    <Card className="p-5" topColor="var(--color-green)">
      <SectionHeader className="mb-1">Class Standings</SectionHeader>
      <p className="mb-4 font-cond text-[11px] uppercase tracking-[0.1em] text-muted/70">Top platoons by shakes</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No classes ranked yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.grade}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${r.grade === highlightGrade ? 'bg-green/10 ring-1 ring-green/30' : ''}`}>
              <span className="w-6 text-center font-cond text-sm font-bold text-navy">{medals[i] || i + 1}</span>
              <span className="flex-1 truncate text-[15px] font-semibold text-navy">Grade {r.grade}</span>
              <span className="font-cond text-[11px] uppercase tracking-wide text-muted/70">{r.soldiers} soldier{r.soldiers === 1 ? '' : 's'}</span>
              <span className="w-14 text-right font-cond text-base font-bold tabular-nums text-green">{fmt(r.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
