// Soldier write-lock — "read-only for soldiers."
//
// HQ asked to close shake-logging from now through the end of the *last* days of
// Yom Tov (Motzei Simchas Torah, 5787). While the lock is on, soldiers can still
// log in and view their own report, but cannot log or edit shakes — the site is
// read-only for them. Admins (school + HQ) are unaffected.
//
// The unlock moment is the evening the last Yom Tov ends (Motzei Simchas Torah),
// after nightfall/Havdalah. Times are the visitor's local clock — the audience
// is Eastern (Crown Heights), so 8:00 PM is safely past tzeis.
//
// >>> If this should instead reopen for CHOL HAMOED (Motzei the FIRST days of
//     Yom Tov), change LOCK_UNTIL to new Date('2026-09-27T20:00:00'). <<<
export const LOCK_UNTIL = new Date('2026-10-04T20:00:00') // Motzei Simchas Torah 5787 (local time)

// True while soldiers are locked out of logging. Defaults to "now" but takes an
// argument so it can be tested. If the date is somehow invalid, fail OPEN (don't
// lock the whole campaign out on a typo) — a locked-open site is recoverable.
export function soldierLocked(now = new Date()) {
  const until = LOCK_UNTIL.getTime()
  if (!Number.isFinite(until)) return false
  return now.getTime() < until
}

// Friendly local date for the "logging reopens…" copy, e.g. "Sunday, Oct 4".
export function lockReopenText() {
  return LOCK_UNTIL.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
