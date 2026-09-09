// ---------------------------------------------------------------------------
// Seed data for the Mivtza Lulav campaign site.
//
// This now comes from the REAL Tzivos Hashem roster (a sampled subset of a few
// schools) — see roster.generated.js, produced by the converter in the
// scratchpad. Kids log in with their real serial number + DOB.
//
// PRIVACY: roster.generated.js holds children's PII and is git-ignored.
// When the real backend is ready, these move server-side.
// ---------------------------------------------------------------------------

import { ROSTER } from './roster.generated.js'

export const SEED = {
  schools: ROSTER.schools,
  kids: ROSTER.kids,
  admins: ROSTER.admins,
  shakes: ROSTER.shakes,
}
