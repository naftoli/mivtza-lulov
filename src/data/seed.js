// ---------------------------------------------------------------------------
// Seed data for the Mivtza Lulav campaign site.
//
// The roster imported here is ANONYMIZED DEMO DATA — see roster.demo.js:
// 5 schools with 201 SYNTHETIC soldiers (fake names, serials and DOBs). It is
// committed on purpose and is safe to deploy publicly.
//
// PRIVACY: the real Tzivos Hashem roster must NEVER be imported here, built,
// or committed. The converter lives outside this repo; if it is ever re-run
// against the real export, its output path (src/data/roster.generated.js) is
// git-ignored and nothing in src/ imports it. As a backstop, the roster guard in
// vite.config.js fails `vite build` (and the dev server) unless the imported
// roster's first line carries the "ANONYMIZED DEMO DATA" marker.
//
// When the real backend (Mashpia) is wired up, the roster lives server-side —
// see docs/mashpia-integration.md.
// ---------------------------------------------------------------------------

import { ROSTER } from './roster.demo.js'

export const SEED = {
  schools: ROSTER.schools,
  kids: ROSTER.kids,
  admins: ROSTER.admins,
  shakes: ROSTER.shakes,
}
