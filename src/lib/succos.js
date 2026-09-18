// Sukkos calendar for the current campaign.
//
// Day 1 of Sukkos is 15 Tishrei. Outside Eretz Yisroel the Lulav is taken on
// every day of Sukkos except Shabbos (day 7 = Hoshana Rabba), so there are
// always exactly six Lulav days — but WHICH day is Shabbos changes every year
// (5786: day 5, 5787: day 1). Update SUKKOS_START each year; the Shabbos day,
// the six Lulav days and the copy that mentions them are all derived from it.
export const CAMPAIGN_YEAR = 5787
const SUKKOS_START = '2026-09-26' // 15 Tishrei 5787 (Shabbos)

const SATURDAY = 6
const [y, m, d] = SUKKOS_START.split('-').map(Number)
const startWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()

// Which day of Sukkos (1–7) falls on Shabbos — exactly one always does.
export const SHABBOS_DAY = ((SATURDAY - startWeekday + 7) % 7) + 1

// The six days Lulav is taken, in order (matches the teacher checklist).
export const LULAV_DAYS = [1, 2, 3, 4, 5, 6, 7].filter((n) => n !== SHABBOS_DAY)

// The campaign runs through Isru Chag Sukkos — the day after Simchas Torah,
// i.e. 24 Tishrei = 9 days after 15 Tishrei. Fixed by the calendar; the end
// date is derived here and is NOT editable by anyone. (Date.UTC rolls the
// day-of-month overflow into the right month.)
export const ISRU_CHAG = new Date(Date.UTC(y, m - 1, d + 9)).toISOString().slice(0, 10)

// 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th" …
export function ordinal(n) {
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th'
  return `${n}${suffix}`
}
