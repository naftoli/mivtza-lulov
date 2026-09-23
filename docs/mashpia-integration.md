# Mivtza Lulav ↔ Mashpia.com — Integration Contract

Connect the Mivtza Lulav app to **Mashpia.com** (where the roster and teacher checklist
already live). On our side the whole integration is one module —
[`src/services/api.js`](../src/services/api.js) (currently a localStorage mock) with the
adapter skeleton in [`src/services/mashpia.js`](../src/services/mashpia.js). Components
never change.

## What the sync must do
1. **Roster from Mashpia** — schools (Bases), classes (Platoons), children, and each child's school + class.
2. **Kid login** = serial number + date of birth.
3. **Staff login** = the same login they already use on Mashpia.com (SSO).
4. **Photos are held pending** until a school admin approves them.
5. **Goals are automatic; only HQ changes them** — a per-child number (default **3**) that HQ can change globally or override for one school. Goals run per class, per school, and nationwide.
6. **End date is fixed to Isru Chag Sukkos** — derived from the calendar, editable by no one.
7. **Profile pictures** show in Recent Shakes and on login.
8. **Two-way** — every shake and photo a child logs writes back into Mashpia, into the same record behind the teacher checklist.

## Endpoints the app needs

### A. Auth
- `verifyKid(serial, dob)` → child record + session token + **`kidKey`**: an opaque,
  **server-issued, non-reversible** key (e.g. HMAC of the serial with a server secret),
  stable across logins. It is the only id public rows carry (see G).
  **Rate-limit / lock out** this endpoint — serials are sequential and DOB is a small search space.
- `verifyAdmin(...)` → Mashpia SSO; returns role (HQ vs school) + the school(s) administered.

### B. Roster (read — admin-only wherever it includes serial / DOB)
- `getSchools()` → `[{ id, name, city, logo? }]`
  - **`logo`** is optional: a URL (or data URI) for the school's crest, shown on the
    school tile in the race, cards and hero. When it is absent the app falls back to a
    colored initials tile, so live currently shows initials everywhere. Send `logo` if
    Mashpia has per-school crests and you want them on the public pages.
- Classes per school → `[{ id, name, schoolId, kidCount }]`
- `getKidsForSchool(schoolId)` → `[{ serial, firstName, lastName, hebFirst, hebLast, dob, gender, class, rank, schoolId, photoUrl }]`
  - `rank` is a text label (e.g. "Sergeant"); `photoUrl` is the profile picture.

### C. Goals
Computed from headcount: **base goal = children × per-child number** (default 3, HQ-adjustable).
**HQ may override one school** with a fixed number (blank = back to automatic).
**Each bonus round = +1 shake per child**, with no limit on rounds — the next one starts as soon as a target is hit.
Applied per class, per school, and nationwide (sum of school base goals).
Mashpia must supply accurate **class / school / national headcounts** and persist two HQ values:
the **global per-child number** and any **per-school override**, scoped to the
current school year.

### D. End date
Not stored, not editable. Derived in [`src/lib/succos.js`](../src/lib/succos.js) from
`SUKKOS_START`; update that once a year and the end date + Lulav days follow.

### E. Daily reports (write — the two-way sync)
Each child has **one cumulative report per Sukkos day**. Choosing a day loads
its current values; saving writes the updated cumulative values directly to
the same `date_tasks_marks` rows used by the teacher checklist.

`PUT /api/me/days/:day`:

| Field | Meaning (teacher-checklist column) |
|---|---|
| `count` | cumulative number of people helped that day (1–65,535) |
| `minutes` | cumulative minutes spent on mivtzoim that day (0–500) |
| `note`, `photos[]` | that day's story + field photos |

The server gets the child from the bearer token and the day from the URL. It
saves what it is given, replacing the stored value, so a number typed too high
can be corrected. A field left out of the body is left exactly as stored.

### F. Photos — approval workflow
Uploads arrive **pending** and stay hidden publicly until approved. Needed: submit-pending,
list-pending for a school (returning **every** photo of each entry), approve / reject an entry,
and **approve-all** for a school (`approveAllPhotos(schoolId)`).
Please specify the accepted format (multipart / base64) and size limit.

### G. Public reads — never serial or DOB
Home and school pages are **unauthenticated**. `getShakes`, `getRecentShakes`, `getLeaderboard`
(suggested `GET /api/schools/:id/shakes`, `/leaderboard`) must return **only**:
`{ id, kidKey, kidName (first + last initial), rank, count, note, photos (approved only), createdAt }`
— **never** `serial`, `dob`, or `gender`. The serial is half the login credential.

## Security
The site is static — it **cannot hold a secret key**. Either issue **per-user tokens at login**,
or route secret-key calls through a **small serverless proxy**. Allow **CORS** from the app's domain.

## Checklist for the Mashpia developer
1. Base URL (+ test URL) and API docs.
2. Kid auth: serial + DOB → token + `kidKey`; rate limiting.
3. Staff SSO: how to authenticate; what it returns (role + schools).
4. Roster endpoints: schools, classes, children (class mapping, rank, photo URL).
5. Headcounts: class / school / national.
6. `POST /shakes` in the shape above, hitting the teacher-grid record; public read endpoints in the no-serial shape (G).
7. Photo endpoints + accepted format and size.
8. App→API auth (token vs. proxy) and CORS.

---

## Mashpia implementation

The Mashpia-side endpoints now live in [`../api`](../api/README.md) and are
served from `/mivtzoim/lulav/api`. Their setup guide documents authentication,
routes, photo limits, CORS, and the task map that connects each child's
cumulative daily report to the same `date_tasks_marks` records used by the
teacher checklist. Supporting task mappings, settings, and photos are scoped
by both the reusable `mivtzoim_id` and the current school year.

The included `api/schema.sql` is intentionally not applied automatically.
