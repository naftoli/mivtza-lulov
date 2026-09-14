# Mivtza Lulav ↔ Mashpia.com Integration Plan

**Goal:** connect this Mivtza Lulav app to **Mashpia.com** (the existing Tzivos Hashem
platform, where the teacher checklist and the soldier roster already live).

When the site is synced to Mashpia, the behavior below should hold. This document is
the **contract** to hand to the Mashpia developer. On our side the whole integration
happens in one module — [`src/services/api.js`](../src/services/api.js) — with a
skeleton adapter at [`src/services/mashpia.js`](../src/services/mashpia.js); the
components never change.

---

## What the sync must do (summary)

1. **Roster** comes from Mashpia: the lists of **children, schools, and classes**, and
   **which school + class each child belongs to**.
2. **Kid login** = the child's **ID (serial number) + date of birth**.
3. **School/staff login** = the **same login they already use on Mashpia.com** (SSO).
4. **Photos must be approved before they post** — uploads are held as *pending* and only
   appear publicly once an admin approves them.
5. **Goals are automatic, never picked** — 5 shakes per child, and every bonus round adds
   1 more shake per child. This runs at **three levels**: each **class**, each **school**,
   and **Main Tzivos Hashem** (nationwide).
6. **Profile pictures**: each child's photo shows in Recent Shakes and when they log in.
7. **Two-way**: everything entered in the app (shakes, reports, photos) **writes back into
   the Mashpia database**, landing where the teacher data already lives.

---

## The contract — endpoints the app needs

### A. Authentication
- **Kid login** — verify **serial number + date of birth**, return the child's record
  (+ a session token scoped to that child).
  - App call: `verifyKid(serial, dob)` · suggested `POST /api/soldier/login`
  - The response must also carry **`kidKey`**: an opaque, **server-issued, non-reversible**
    key for the child (e.g. an HMAC of the serial with a server secret), stable across
    logins. It is the only id public rows carry (see F); the app uses it just to highlight
    the child's own leaderboard row. It must not be derivable from the serial client-side.
  - This endpoint needs **rate limiting / lockout**: serials are sequential and a date of
    birth has a small search space.
- **School / staff login** — **use Mashpia's existing login** (SSO / same credentials as
  Mashpia.com), returning which school(s) the user administers and their role (HQ vs school).
  - App call: `verifyAdmin(...)`

### B. Roster (read) — children, schools, classes
- `getSchools()` → `[{ id, name, city }]` (**Base** = school)
- Classes per school → `[{ id, name (Platoon), schoolId, kidCount }]`
- `getKidsForSchool(schoolId)` → children, each mapped to their school **and class**:
  `{ serial, firstName, lastName, hebFirst, hebLast, dob, gender, class (=Platoon), rank, schoolId, photoUrl }`
  - **`photoUrl`** is the child's profile picture (used in Recent Shakes + on login).

### C. Goals — automatic at every level (no one picks them)
Preset formula, computed from headcount:
- **Base goal = children × 5**
- **Each bonus round = +1 shake per child** (×6, ×7, … and it auto-advances as targets are hit)

Applied to **each class** (children in that class), **each school** (all its children), and
**Main TH** (all children nationwide). The app computes these from the roster counts, so
Mashpia just needs to supply accurate **class/school/national headcounts** (and update them
as children are added/moved).

### D. Reports & shakes (write — the two-way sync)
Everything a child enters flows back to Mashpia. The Succos report mirrors the teacher
checklist one-to-one:

| App field | Teacher-checklist column |
|---|---|
| `days: number[]` | went on מבצע לולב on the Nth day of Succos — a subset of that year's six Lulav days (the Shabbos day is skipped; for 5787 day 1 is Shabbos, so `[2,3,4,5,6,7]`). The app derives the list from the Sukkos start date in `src/lib/succos.js`; store the day numbers as sent. |
| `minutes` | minutes spent on מבצע לולב |
| `peopleWithFriends` | people shaken **with friends** (total together) |
| `peoplePersonal` | people shaken **personally** (divide if shared) |
| `story`, `photos[]` | extra (story + field photos) |

- App calls: `saveReport(serial, payload)` and `addShake(...)`
- Suggested endpoints: `POST /api/soldier/:serial/lulav-report`, `POST /api/shakes`
- **Write to the same record behind the teacher grid** so the teacher and kid views agree.

### E. Photos — approval workflow
- Uploaded photos are submitted as **pending** and are **not shown publicly** until a school
  admin **approves** them. Mashpia needs endpoints to: submit a photo (pending), list pending
  photos for a school, approve/reject one entry, and **approve all pending for a school** in one
  call (the admin page has an "Approve all (N)" button — `approveAllPhotos(schoolId)`).
- Approval is per **entry**, and an entry can carry several photos, so the pending list must
  return **every** photo URL of each entry (not just the first) — the admin sees them all
  before approving.
- Accepted format (multipart upload or base64?) and size limit — please specify.

### F. Public reads — never expose serials or DOB
The school campaign page (recent-shakes feed, photo wall, leaderboard) and the home page are
**unauthenticated**. Every row those endpoints return must contain **only**:
`{ id, kidKey, kidName (first name + last initial), count, note, photos (approved only), createdAt }`
— **never** `serial`, `dob`, or `gender`. The serial is half of the child's login credential,
so a public name → serial mapping would materially lower the bar for logging in as a child.
- `kidKey` is the same opaque key the login response returns (see A) — it is the only link
  between a public row and the logged-in child.
- App calls: `getShakes(schoolId)`, `getRecentShakes(schoolId)`, `getLeaderboard(schoolId)`
  · suggested `GET /api/schools/:id/shakes`, `GET /api/schools/:id/leaderboard`
- Roster reads that do include `serial` / `dob` (section B) are **admin-only** and must
  require the staff token.

---

## Security (browser app)
- The site is **static** and **cannot hold a secret API key** (anything shipped to the
  browser is public). So either the API issues **per-user tokens at login** (safe in the
  browser), or secret-key calls go through a **small serverless proxy** we add.
- The API must allow **CORS** from the app's domain.

---

## What I need from the Mashpia developer
1. **Base URL** (+ test URL) and any API docs.
2. **Kid auth**: verify serial + DOB → token + `kidKey` (format/expiry); rate limiting on the login endpoint.
3. **School/staff SSO**: how to authenticate against Mashpia's existing login; what it returns (role + schools).
4. **Roster endpoints**: schools, **classes**, and children (with class mapping + **profile photo URL**).
5. **Headcounts**: class / school / national counts (drive the automatic goals).
6. **Report + shake write endpoints** + exact payloads — and confirmation they hit the same record as the teacher grid.
   Plus the **public read endpoints** (shakes, leaderboard) in the no-serial / no-DOB shape from section F.
7. **Photo endpoints**: submit-pending, list-pending, approve/reject; accepted format + size.
8. **App→API auth** (per-user token vs. key+proxy) and **CORS** for our domain.

With these, Phase 1 (login + roster) wires up quickly, then Phase 2 (reports/photos two-way sync).
