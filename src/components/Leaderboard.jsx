import { fmt } from '../lib/format.js'
import { asset } from '../lib/asset.js'
import { Card, SectionHeader } from './ui.jsx'

// Rank marker shared by the standings lists: the 3D medal renders for the top
// three (displayed at ~0.5x of the 52x60 source — never upscaled), then italic
// blue-accent numerals, exactly like the comp's race card.
const MEDALS = [
  ['medal-gold', '1st place'],
  ['medal-silver', '2nd place'],
  ['medal-bronze', '3rd place'],
]
export function RankBadge({ index }) {
  const medal = MEDALS[index]
  return (
    <span className="grid w-8 shrink-0 place-items-center">
      {medal ? (
        <img src={asset(`design/${medal[0]}.png`)} alt={medal[1]} className="h-8 w-auto" />
      ) : (
        <span className="font-display text-lg font-bold italic leading-none text-blue-accent">{index + 1}</span>
      )}
    </span>
  )
}

// Top soldiers by shakes for a school ("Most shakes in school").
// Rows carry the opaque kidKey (never the serial); highlightKidKey is the
// logged-in kid's own key from the login response.
export default function Leaderboard({ rows, highlightKidKey }) {
  return (
    <Card className="p-5 sm:p-6" topColor="var(--color-gold)">
      <SectionHeader className="mb-1">Chayol Leaderboard</SectionHeader>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy/60">Most shakes in school</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-navy/70">No soldiers ranked yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.kidKey}
              className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 ${r.kidKey === highlightKidKey ? 'bg-white/55 ring-1 ring-green-mid' : ''}`}>
              {/* The child's army rank logo (falls back to its name, then place). */}
              {r.rankImageUrl ? (
                <span className="grid w-14 shrink-0 place-items-center" title={r.rank}>
                  <img src={r.rankImageUrl} alt={r.rank || 'Rank'} className="h-10 w-10 object-contain" />
                </span>
              ) : r.rank ? (
                <span className="grid w-14 shrink-0 place-items-center" title={r.rank}>
                  <span className="text-center font-cond text-[11px] font-semibold uppercase leading-[1.05] tracking-[0.01em] text-green">{r.rank}</span>
                </span>
              ) : (
                <RankBadge index={i} />
              )}
              <span className="flex-1 truncate text-[15px] font-semibold text-navy">{r.name}</span>
              <span className="font-display text-base font-bold tabular-nums text-green">{fmt(r.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
