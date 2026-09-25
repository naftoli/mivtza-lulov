# Mivtza Lulav API

The API is served from `/mivtzoim/lulav/api`. It uses short-lived, signed bearer
tokens and the existing Mashpia roster, admin accounts, Mivtzoim campaigns, and
teacher-grid marks. The campaign id is `LULAV_MIVTZOIM_ID` in `bootstrap.php`
(currently `10`). Change that constant when a new campaign row is used.

## Setup

1. Review and apply `schema.sql` to `mashpiadb`. It creates only photo, goal,
   and task-map tables; the API never applies schema changes automatically.
   If those tables already exist from an earlier draft, also apply
   `schema.upgrade.sql` so `school_year` is present.
2. Ensure `date_tasks_marks` has the `updated DATETIME` column recorded in
   `mashpia.com/sql/database.sql`.
3. Add one `lulav_api_task_map` row for each field in the current school year:
   - six quantity `day` rows, one for each non-Shabbos day;
   - six quantity `minutes` rows for the same days.
   Set `school_year` to `GlobalSettings::getCurrentYear()`. Task mappings,
   campaign goals, school overrides, and photos are all isolated by this value
   because the same `mivtzoim_id` is reused in later years.
4. The built app uses this API by default; `?demo=1` opens the sample
   roster instead.

5. For local UI testing without a VM, start the PHP API and Vite together:

   ```bash
   npm run dev:api
   npm run dev
   ```

   Vite proxies `/mivtzoim/lulav/api` to `http://localhost:8080`. Open
   `http://localhost:5173/mivtzoim/lulav/` and log in with a real serial and
   DOB.

6. Set `LULAV_TOKEN_SECRET` in `mashpia.com/includes/globals.php` (gitignored)
   to a random secret of at least 32 characters. Do not reuse Mashpia's
   legacy mobile-token secret. The local `dev:api` router supplies a
   development-only fallback if that constant is missing.
7. If the app is hosted on another origin, set `LULAV_ALLOWED_ORIGINS` to a
   comma-separated allowlist. Same-origin requests work without configuration.
8. Optionally set `LULAV_TOKEN_TTL` in seconds. The default is 43,200 (12 hours).
9. **Soldier sign-in opens at a fixed moment.** Before sunset in Crown Heights
   on `LULAV_KID_LOGIN_OPENS_DATE` (in `bootstrap.php`; currently Sunday
   27 September 2026, 6:44 PM EDT), `/soldier/login`, `/soldier/handoff` and
   `/parent/handoff` answer 403 with the opening time, and any existing soldier
   session is refused. Admins and the public pages are unaffected. Set
   `LULAV_KID_LOGIN_OPENS_AT` to any zoned time (`2000-01-01 00:00 UTC` to open
   it now) to override — e.g. to try the soldier flow locally before then.
10. **High-number alerts.** A day saved at 50+ shakes or 180+ minutes is
    emailed to HQ and Shimmy, Cc the school's Base Commanders (see
    `LULAV_ALERT_*` and `lulavBaseCommanderEmails()` in `index.php`). Set
    `LULAV_MAIL_CAPTURE` to a file path to write alerts there as JSON lines
    instead of sending them; the local `dev:api` router does this by default,
    since it reads the real database.

Runtime photos, login-rate-limit files and cached public reads are written to
`mashpia.com/storage/lulav`, outside the public document root. The web-server
user must be able to create and write that directory.

- `photos/` — the only copy of every uploaded photo. Never delete; not in git,
  not in the database, and not recreatable. Back it up separately.
- `rate-*.json` — login-throttle counters, one per bucket and IP. Safe to
  delete; clearing them resets any window currently in progress.
- `cache/c-*.json` — `GET /stats`, `GET /schools` and `GET /schools/:id`, held
  for `LULAV_CACHE_TTL` (30 s). Those reads total every school's marks out of
  a 103-million-row `date_tasks_marks`, and they are what the whole country
  loads at once. Safe to delete; writes flush them, so a save or a moderation
  shows immediately rather than at the TTL.

Each task-map row supplies the `grid_id`, `start_date`, and `end_date` consumed
by `Mivtzoim::markTasks()`. Consequently, app report writes and teacher-grid
writes update the same `date_tasks_marks` records.

Use this read-only query to inspect candidate tasks before inserting the map:

```sql
SELECT m.mivtzoim_id, m.name AS campaign, dt.grid_id, dt.short_name,
       dt.name AS task, mission.start_date, mission.end_date
FROM mivtzoim m
JOIN mivtzoim_tasks mt USING (mivtzoim_id)
JOIN date_tasks dt ON dt.short_name = mt.short_name
JOIN date_tasks_missions mission USING (date_tasks_mission_id)
WHERE m.mivtzoim_id = 10
  AND mission.subject_id = 12
  AND mission.lang_id = 1
  AND mission.start_date >= m.start
  AND mission.end_date <= m.end
ORDER BY m.start DESC, dt.short_name, mission.start_date;
```

## Endpoints

### Authentication

- `POST /soldier/login` — `{ "serial": "...", "dob": "YYYY-MM-DD" }`
- `POST /admin/login` — `{ "username": "...", "password": "..." }`

Both return `{ token, expiresIn, soldier|admin }`. Send the token as
`Authorization: Bearer <token>`.

### Parent handoff

The parent site (`mobile/reg/parent_detail.html`) signs a child in without
knowing their serial + date of birth, in two steps:

- `POST /parent/soldiers` — `{ "parent": "<mobile session token>" }` → the
  parent's children who take part in the campaign, so the parent site only
  shows the button where it leads somewhere.
- `POST /parent/handoff` — `{ "parent": "...", "child": <user_id> }` →
  `{ code, expiresIn }`, a code valid for two minutes that names one child.
- `POST /soldier/handoff` — `{ "code": "..." }` → the same
  `{ token, expiresIn, soldier }` `/soldier/login` returns.

`parent` is the `admin` cookie the mobile parent pages already post to
`mobile/reg/ajax/*.php` (verified through `Auth::authenticate(..., 'mobile')`);
ownership is the `admin_auths` family link. It is posted rather than read from
the cookie header because the app's webview does not reliably carry cookies
into a fresh page load. The code is what travels in the SPA's URL — it carries
no parent session and can only be traded for that one child's token.

### Roster and campaign

- `GET /schools` — public school totals and automatic goals
- `GET /schools/:id` — public school campaign
- `PATCH /schools/:id` — authorized admin; update `motto`
- `GET /schools/:id/classes` — authorized school/HQ admin
- `GET /schools/:id/soldiers` — authorized school/HQ admin
- `GET /schools/:id/leaderboard` — public soldier standings with opaque IDs
- `GET /schools/:id/class-leaderboard` — public class standings and goals
- `GET /stats` — public nationwide totals and goals

Participating schools are those with a `school_registrations` row for
`GlobalSettings::getCurrentYear()`. Schools listed by
`GlobalSettings::getAustralian()` also qualify through a registration from the
previous year.

**Every year in this API comes from `getCurrentYear()`, never
`getRegistrationYear()`** — deliberately, and `lulavCurrentSchoolYear()` is the
single source. Most of Mashpia gates `user_registration` and
`school_registrations` on `getRegistrationYear()`, because those flows ask
"which year are we selling". This one asks "which cohort is enrolled right
now", and `user_registration.year` records the school year a child enrolled
for. Do not align it with the registration flow: the two `global_settings`
rows can legitimately differ at a rollover, and following `registration_year`
would swap the campaign's roster for next year's sign-ups.

The Australian offset is handled differently here on purpose too.
`getRegistrationYear()` picks one year by calendar month; this API accepts
either the current or the previous year for those schools, which is
month-independent and is what a one-week Succos campaign wants. Both read the
same school list from `getAustralian()`.

The roster and all child counts use the matching rule in `user_registration`:
current-year registrations, plus previous-year registrations for Australian
schools. This rule is centralized in `lulavEligibleUserCondition()` so it can
later be replaced by a per-child Lulav flag.

The default school goal is registered headcount × the HQ-managed per-child
goal (initially 3). HQ can override one school. Percentages are calculated
against that effective base goal and may exceed 100. Reaching the goal starts
bonus round 1, and bonus rounds never run out: each round's target adds one
more shake per registered child, and the next round starts as soon as the
current target is reached. `bonusLevel` (0 before the goal) and `bonusGoal`
(always still ahead of `total`) are derived from the totals on every read.

### Cumulative daily reports

- `GET /me/days/:day` — child; load current daily values
- `PUT /me/days/:day` — child; save `{ count, minutes, note, photos[] }`
- `POST /shakes` — compatibility alias; body includes `day`
- `GET /me/shakes` — child; all current daily reports
- `GET /schools/:id/shakes` — public; admin may add `?includeHidden=1`
- `PATCH /shakes/:id` — admin; `{ hidden: true|false }`
- `GET /schools/:id/report-rows` — authorized school/HQ admin

Each child/day is one cumulative report. Its shakes, minutes, story, inactive
state, and exact timestamp live in mapped `date_tasks_marks` rows. The API
prefills these values and saves what it is given, so a number typed too high
can be corrected by saving the right one over it. Recent Shakes shows the
current daily total ordered by `date_tasks_marks.updated`.

Every field is last-write-wins — `note` and `photos` because the child's form
has a per-photo delete button and an emptied story has to be savable, `count`
and `minutes` because a wrong number has to be fixable — but **only when the
field is actually sent**:

| field in the request body | effect |
| --- | --- |
| absent | left exactly as stored |
| `"note": ""` / `"photos": []` | cleared |
| present with a value | replaces the stored value |

`count` is the one required field, so it always replaces what is stored. So
`POST /shakes` with just `{ day, count }` records the count and leaves that
day's minutes, story and photos untouched. Sending `photos` as anything other
than an array is a 422 rather than a silent clear. The web app always sends
every key, so its behaviour is unchanged.

### HQ settings

- `GET /settings` — HQ only
- `PATCH /settings` — HQ only; `{ perKidGoal }`
- `PATCH /schools/:id/goal` — HQ only; `{ goalOverride: number|null }`

### Photo moderation

- `GET /schools/:id/photos/pending` — authorized school/HQ admin
- `POST /shakes/:id/photos/approve` — approve every photo in a daily report
- `POST /shakes/:id/photos/reject` — reject every photo in a daily report
- `POST /schools/:id/photos/approve-all` — approve all pending daily reports
- `GET /photos/:id/file` — public only after approval

Uploads are JSON data URLs (`image/jpeg`, `image/png`, or `image/webp`), at most
5 MB each. Daily reports accept eight photos. Pending files
are returned inline only to their child or an authorized admin and are not
available from the public file endpoint. Apache also caps the complete request
body at 16 MB.

## Tests

Two suites, for two different jobs.

```bash
php api/tests/mock/run.php          # no server, no database, no setup
LULAV_TEST_BASE=https://… php api/tests/run.php   # against a deployed API
```

`tests/mock` runs the real `bootstrap.php` and `index.php` inside a throwaway
tree in the system temp directory, against a fake PDO that answers by matching
each statement to a fixture pattern. It covers every route: the public reads,
login, a child's day report, saving, moderation, HQ settings, the response cache
and the 404. Because it is the fixtures that answer, a query rewritten into a
shape no fixture recognises fails the run rather than silently returning
nothing — that is what the suite is for.

What it cannot check is whether a query means what it should in SQL: joins,
indexes and the planner are outside the fake. Check those against a real
database with `EXPLAIN`, and use `tests/run.php` for an end-to-end pass.

The fixtures mirror production: six campaign days numbered 2–7, two schools,
three children. `tests/mock/fixtures.php` is the place to add a case.
