# Mivtza Lulav — Tzivos Hashem

A campaign platform for **Mivtza Lulav**: Tzivos Hashem "soldiers" (kids) go out over
Succos to help other Yidden shake Lulav & Esrog, and log their mivtzoim. Each school has
a live campaign page (goal thermometer, recent shakes, leaderboards, photo wall, bonus
rounds), and kids log in with their **serial number + date of birth** to record shakes,
upload photos, and fill in a Succos report that mirrors the teacher checklist.

Built with **React 19 + Vite + Tailwind v4 + React Router**.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
```

Then open the local URL (default http://localhost:5173).

### Demo logins
- **Soldier:** serial `100000` · DOB `2015-01-01`
- **Admin (HQ):** `hq` / `lulav`  ·  **School admin:** the school id (e.g. `oholei-torah`) / `lulav`

## What's inside
- **Public:** home + nationwide totals, the "race" between schools, per-school campaign pages
  (goal meter, recent shakes, soldier & class leaderboards, Mivtzoim pictures, share card + QR).
- **Soldier dashboard:** log shakes (with photos & story), a **Succos report** (day checkboxes,
  minutes, people-with-friends / people-personally), rank display, milestone confetti + mascot.
- **Admin:** HQ command center with a school switcher, campaign settings, roster, photo/entry
  moderation, and the teacher-style **Mivtza Lulav Report** grid populated from kids' reports.
- **How-To** guide: the bracha and how to help another Yid shake.

## Data & the backend

All screens read/write through a single module, [`src/services/api.js`](src/services/api.js),
which is currently backed by the browser (localStorage) for a self-contained demo.

The repo ships with **anonymized demo data** — [`src/data/roster.demo.js`](src/data/roster.demo.js)
contains **fake** soldiers. **No real children's data is in this repository.**

To connect the real Tzivos Hashem platform (**Mashpia.com**), see
[`docs/mashpia-integration.md`](docs/mashpia-integration.md) and the adapter skeleton at
[`src/services/mashpia.js`](src/services/mashpia.js).

> ⚠️ **Privacy:** never commit or build the real roster. The real-data files (`*soldiers*.html`,
> `*soldiers*.zip`) and the converter's output path (`src/data/roster.generated.js`) are
> git-ignored, and nothing in `src/` imports them. As a backstop, the roster guard in
> [`vite.config.js`](vite.config.js) makes `vite build` (and the dev server) fail unless the
> imported roster's first line carries the `ANONYMIZED DEMO DATA` marker — so a real export
> cannot end up in the public bundle even by mistake.
