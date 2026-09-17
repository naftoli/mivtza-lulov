# Mivtza Lulav API

The API is served from `/mivtzoim/lulav/api`. It uses short-lived, signed bearer
tokens and the existing Mashpia roster, admin accounts, Mivtzoim campaigns, and
teacher-grid marks.

## Setup

1. Review and apply `schema.sql` to `mashpiadb`. It creates only photo, goal,
   and task-map tables; the API never applies schema changes automatically.
2. Ensure `date_tasks_marks` has the `updated DATETIME` column recorded in
   `mashpia.com/sql/database.sql`.
3. Add one `lulav_api_task_map` row for each field in the current campaign:
   - six quantity `day` rows, one for each non-Shabbos day;
   - six quantity `minutes` rows for the same days.
4. Point the app at:

   ```text
   VITE_MASHPIA_API=/mivtzoim/lulav/api
   ```

5. Set `LULAV_TOKEN_SECRET` to an application-specific random secret of at
   least 32 characters. Do not reuse Mashpia's legacy mobile-token secret.
6. If the app is hosted on another origin, set `LULAV_ALLOWED_ORIGINS` to a
   comma-separated allowlist. Same-origin requests work without configuration.
7. Optionally set `LULAV_TOKEN_TTL` in seconds. The default is 43,200 (12 hours).

Runtime photos and login-rate-limit files are written to
`mashpia.com/storage/lulav`, outside the public document root. The web-server
user must be able to create and write that directory.

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
WHERE LOWER(m.name) LIKE '%lulav%'
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

### Roster and campaign

- `GET /schools` — public school totals and automatic goals
- `GET /schools/:id` — public school campaign
- `PATCH /schools/:id` — authorized admin; update `motto`
- `GET /schools/:id/classes` — authorized school/HQ admin
- `GET /schools/:id/soldiers` — authorized school/HQ admin
- `GET /schools/:id/leaderboard` — public soldier standings with opaque IDs
- `GET /schools/:id/class-leaderboard` — public class standings and goals
- `GET /stats` — public nationwide totals and goals

The default school goal is registered headcount × the HQ-managed per-child
goal (initially 3). HQ can override one school. Percentages are calculated
against that effective base goal and may exceed 100. Reaching the goal starts
one bonus round whose target adds one shake per registered child.

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
prefills these values and saves the larger of the submitted and current value,
so a stale child form cannot reduce a larger teacher-entered number. Recent
Shakes shows the current daily total ordered by `date_tasks_marks.updated`.

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
