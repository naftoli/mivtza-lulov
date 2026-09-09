import { fmt } from '../lib/format.js'
import { Card, SectionHeader } from './ui.jsx'

const medals = ['🥇', '🥈', '🥉']

// Top soldiers by shakes for a school ("Most shakes in school").
export default function Leaderboard({ rows, highlightKidId }) {
  return (
    <Card className="p-5" topColor="var(--color-gold)">
      <SectionHeader className="mb-1">Leaderboard</SectionHeader>
      <p className="mb-4 font-cond text-[11px] uppercase tracking-[0.1em] text-muted/70">Most shakes in school</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No soldiers ranked yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.kidId}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${r.kidId === highlightKidId ? 'bg-gold/15 ring-1 ring-gold/40' : ''}`}>
              <span className="w-6 text-center font-cond text-sm font-bold text-navy">{medals[i] || i + 1}</span>
              <span className="flex-1 truncate text-[15px] font-semibold text-navy">{r.name}</span>
              <span className="font-cond text-base font-bold tabular-nums text-blue">{fmt(r.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
