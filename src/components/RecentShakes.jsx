import { fmt, timeAgo } from '../lib/format.js'
import { Card, SectionHeader, Avatar } from './ui.jsx'

// The "recent donors" equivalent — a live feed of the latest shakes.
// Sky card: names navy, counts green-deep, small labels Exo semibold caps.
export default function RecentShakes({ shakes }) {
  return (
    <Card className="p-5 sm:p-6" topColor="var(--color-blue)">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader>Recent Shakes</SectionHeader>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-green">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-mid" /> live
        </span>
      </div>

      {shakes.length === 0 ? (
        <p className="py-8 text-center text-sm text-navy/70">No shakes yet — be the first soldier on the board!</p>
      ) : (
        <ul className="space-y-3">
          {shakes.map((s) => (
            <li key={s.id} className="flex animate-rise items-center gap-3">
              {s.kidPhoto ? (
                <Avatar name={s.kidName} src={s.kidPhoto} size={44} />
              ) : s.rank ? (
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-green/10 ring-1 ring-green/20" title={s.rank}>
                  <span className="px-1 text-center font-cond text-[10px] font-semibold uppercase leading-[1.03] tracking-[0.01em] text-green">{s.rank}</span>
                </span>
              ) : (
                <Avatar name={s.kidName} size={44} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight">
                  <span className="font-semibold text-navy">{s.kidName}</span>
                  <span className="text-navy/45"> · </span>
                  <span className="font-bold tabular-nums text-green">{fmt(s.count)} shakes</span>
                </p>
                {s.note && <p className="truncate text-xs italic text-navy/70">“{s.note}”</p>}
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/55">{timeAgo(s.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
