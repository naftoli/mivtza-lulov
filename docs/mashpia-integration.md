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
- `getSchools()` → `[{ id, name, city }]`
- Classes per school → `[{ id, name, schoolId, kidCount }]`
- `getKidsForSchool(schoolId)` → `[{ serial, firstName, lastName, hebFirst, hebLast, dob, gender, class, rank, schoolId, photoUrl }]`
  - `rank` is a text label (e.g. "Sergeant"); `photoUrl` is the profile picture.

### C. Goals
Computed from headcount: **base goal = children × per-child number** (default 3, HQ-adjustable).
**HQ may override one school** with a fixed number (blank = back to automatic).
**Each bonus round = +1 shake per child**, auto-advancing as targets are hit.
Applied per class, per school, and nationwide (sum of school base goals).
Mashpia must supply accurate **class / school / national headcounts** and persist two HQ values:
the **global per-child number** and any **per-school override**.

### D. End date
Not stored, not editable. Derived in [`src/lib/succos.js`](../src/lib/succos.js) from
`SUKKOS_START`; update that once a year and the end date + Lulav days follow.

### E. Shakes (write — the two-way sync)
The child logs **one entry per Sukkos day**. There is **no separate "report" object** — the
teacher grid is derived from these entries (`getSchoolReportRows`).

`addShake(entry)` — suggested `POST /api/shakes`:

| Field | Meaning (teacher-checklist column) |
|---|---|
| `day` | which Sukkos day, 2–7 (day 1 is Shabbos in 5787; derived from `succos.js` — store as sent) |
| `count` | number of people helped to shake |
| `minutes` | minutes spent on mivtzoim |
| `note`, `photos[]` | story + field photos |
| `rank`, `kidName`, `schoolId`, `createdAt` | copied from the child record / system time |

Write to the same record the teacher grid reads, so both views agree.

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

Phase 1 = login + roster. Phase 2 = shakes / photos two-way sync.
