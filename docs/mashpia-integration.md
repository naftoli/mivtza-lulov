# Mivtza Lulav ↔ Mashpia.com Integration Plan

**Goal:** connect this Mivtza Lulav app to **Mashpia.com** (the existing Tzivos Hashem
platform, where the teacher checklist and the soldier roster already live).

This document is the **contract** to hand to the Mashpia developer: it lists exactly
what the app needs to read and write. Once we have real endpoints, wiring it is small.

---

## Why this is a small change on our side

Every screen in the app talks to **one module**: [`src/services/api.js`](../src/services/api.js).
Every function returns a `Promise`. Today those functions read/write the browser
(mock data). To connect to Mashpia, we replace each function body with a call to a
Mashpia endpoint — the components never change. A skeleton adapter is stubbed at
[`src/services/mashpia.js`](../src/services/mashpia.js).

---

## Phasing

| Phase | What | Needs from Mashpia |
|---|---|---|
| **1. Login + roster** | Kids sign in with their Mashpia identity; schools & soldiers come from Mashpia (no more file import) | Auth endpoint + roster endpoints |
| **2. Push reports** | Each kid's Succos report (and shake entries) is written back into Mashpia, landing where the teacher grid lives | Report write endpoint(s) |
| **3. Fold into Mashpia** | These kid-facing pages become part of Mashpia.com | Decision on hosting/embedding |

---

## The contract — what the app needs

### A. Authentication (Phase 1)

- **Soldier login** — the app collects **serial number + date of birth** and needs to verify them and get back that soldier's record (and ideally a session token scoped to that soldier).
  - App calls: `verifyKid(serial, dob)`
  - Suggested endpoint: `POST /api/soldier/login` → `{ token, soldier: { … } }`
- **Admin login** — HQ + per-school staff (username/password today).
  - App calls: `verifyAdmin(username, password)`

### B. Roster / schools (Phase 1, read-only)

The app needs the same data as the roster export already produced from Mashpia
(`Serial Number, First/Last Name, Hebrew names, DOB, Gender, Platoon, Base, Rank, Family ID`).

- `getSchools()` → list of schools: `{ id, name, city }` (**Base** = school)
- `getKidsForSchool(schoolId)` → soldiers in that school:
  `{ serial, firstName, lastName, hebFirst, hebLast, dob, gender, grade (=Platoon), rank, schoolId }`

### C. Campaign goals (decision needed)

Goals/baselines are currently set in the app. **Where should they live?**
- Option 1: stay in this app (schools set their own goal).
- Option 2: come from Mashpia (a `goal` field per school).

### D. Reports — the key write (Phase 2)

The kid-facing **Succos report** mirrors the teacher checklist one-to-one:

| App field | Teacher-checklist column |
|---|---|
| `days: [1,2,3,4,6,7]` | "I went on מבצע לולב … on the Nth day of Succos" (one checkbox per day; 5th day = Shabbos, skipped) |
| `minutes` | "How many minutes did you spend on מבצע לולב?" |
| `peopleWithFriends` | "How many people did you shake … **with in total together with your friend/s**?" |
| `peoplePersonal` | "How many people did you **personally** shake … (if with a friend/family, divide your total)" |
| `story`, `photos[]` | (extra — not on the teacher sheet) |

- App calls: `saveReport(serial, payload)` where payload is:
  ```json
  {
    "serial": "1234567",
    "schoolId": "oholei-torah",
    "year": 5787,
    "days": [1, 3],
    "minutes": 90,
    "peopleWithFriends": 60,
    "peoplePersonal": 30,
    "story": "…",
    "photos": ["<url or base64>"]
  }
  ```
- Suggested endpoint: `POST /api/soldier/:serial/lulav-report`
- **Does Mashpia already have a "Mivtza Lulav report" record** (the object behind the
  teacher grid)? If so, we should write to that same object so teacher + kid views agree.

Optionally, individual **shake entries** (count + photo + note + timestamp) can also be
pushed: `addShake(...)`.

---

## Security notes (important for a browser app)

- This app is **static** (e.g. hosted on Netlify). It **cannot safely hold a secret API key** —
  anything shipped to the browser is public. So either:
  - the API authenticates **per soldier/admin** with a token issued at login (safe in the browser), **or**
  - secret-key calls go through a **small serverless proxy** (e.g. a Netlify Function) we add.
- Mashpia's API must allow **CORS** from the app's domain.
- Photos: does the report endpoint accept image **uploads** (multipart) or **base64**, and what's the size limit?

---

## What I need from the Mashpia developer to wire it up

1. **Base URL** of the API + any docs.
2. **Soldier auth**: how to verify serial + DOB; token format/expiry.
3. **Roster endpoints** for schools and soldiers (fields as in the export).
4. **Report endpoint** + the exact payload it expects — and whether it maps to the
   existing teacher-checklist object.
5. **App→API auth**: per-user tokens, an API key (→ we add a proxy), or OAuth?
6. **CORS**: allow the app's domain.
7. **Photos**: accepted format + size limit (or an upload endpoint).
8. **Goals**: do they live in Mashpia or stay in this app?

With answers to those, Phase 1 (login + roster) is a quick wire-up, then Phase 2 (reports).
