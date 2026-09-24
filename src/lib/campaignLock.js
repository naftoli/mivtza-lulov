// Soldier write-lock — "read-only for soldiers."
//
// HQ asked to close shake-logging from now until the FIRST days of Yom Tov end
// (Motzei the second day, 5787) — it must be OPEN for Chol Hamoed. While the lock
// is on, soldiers can still log in and view their own report, but cannot log or
// edit shakes — the site is read-only for them. Admins (school + HQ) unaffected.
//
// The unlock moment is the evening the first days of Yom Tov end, after
// nightfall/Havdalah. Times are the visitor's local clock — the audience is
// Eastern (Crown Heights), so 8:00 PM is safely past tzeis.
//
// Day 1 (15 Tishrei) is Shabbos this year, so the second day is Sun 27 Sep.
export const LOCK_UNTIL = new Date('2026-09-27T20:00:00') // Motzei the second day of Yom Tov 5787 (local time)

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
