// Flagging unusually high shake reports for admin review + notification.
//
// When a soldier reports an outsized number, it should be surfaced to the school,
// to HQ and to the campaign owner. The email/push side is the server's job (see
// docs/mashpia-integration.md §H) — this module is the app side: it decides what
// counts as "high" so the admin screens can flag it, and so a submit-time notice
// can warn a child who is about to file an obviously wrong number.
//
// Thresholds are HQ's call; these are deliberately generous, since the normal
// per-soldier goal is only a few shakes a day, so only clearly outsized entries
// trip them. Each child files ONE report per Sukkos day, so a single entry's
// count IS that day's total — the per-entry and per-day checks are the same here.
export const HIGH_SHAKES = 50       // 50+ shakes reported for one day
export const HIGH_MINUTES = 180     // 3+ hours on mivtzoim reported for one day

// Human-readable reasons an entry is flagged (for the admin badge tooltip).
// If the server already decided (flagReason / flagged — see §H) we honour that,
// so the badge reflects the server's rule even if it differs from ours.
export function highReasons(entry) {
  if (!entry) return []
  if (entry.flagReason) return [String(entry.flagReason)]
  const reasons = []
  const count = Number(entry.count) || 0
  const minutes = Number(entry.minutes) || 0
  if (count >= HIGH_SHAKES) reasons.push(`${count} shakes in one day`)
  if (minutes >= HIGH_MINUTES) reasons.push(`${minutes} minutes in one day`)
  return reasons
}

// Should this entry be flagged for review?
export function isHighEntry(entry) {
  if (entry?.flagged) return true
  return highReasons(entry).length > 0
}

// Would this about-to-be-saved report trip a flag? (submit-time warning)
export function isHighInput({ count, minutes }) {
  return (Number(count) || 0) >= HIGH_SHAKES || (Number(minutes) || 0) >= HIGH_MINUTES
}
