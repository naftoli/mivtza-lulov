import { fmt, timeAgo } from '../lib/format.js'
import { Card, SectionHeader, Avatar } from './ui.jsx'

// The "recent donors" equivalent — a live feed of the latest shakes.
export default function RecentShakes({ shakes }) {
  return (
    <Card className="p-5" topColor="var(--color-blue)">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader>Recent Shakes</SectionHeader>
        <span className="flex items-center gap-1.5 font-cond text-[11px] font-semibold uppercase tracking-[0.1em] text-green">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green" /> live
        </span>
      </div>

      {shakes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No shakes yet — be the first soldier on the board!</p>
      ) : (
        <ul className="space-y-3">
          {shakes.map((s) => (
            <li key={s.id} className="flex animate-rise items-center gap-3">
              <Avatar name={s.kidName} src={s.kidPhoto} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-tight">
                  <span className="font-semibold text-navy">{s.kidName}</span>
                  <span className="text-muted"> · </span>
                  <span className="font-bold text-blue">{fmt(s.count)} shakes</span>
                </p>
                {s.note && <p className="truncate text-xs italic text-muted">“{s.note}”</p>}
                <p className="font-cond text-[11px] uppercase tracking-[0.08em] text-muted/70">{timeAgo(s.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
