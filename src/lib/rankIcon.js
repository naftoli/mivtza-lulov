import { asset } from './asset.js'

// The Tzivos Hashem rank insignia, keyed by the rank's NAME. The roster and the
// live API name a child's rank in words ("Colonel", "Second Lieutenant", a star
// general); this maps that name to the crest so the same artwork shows in the
// demo and against live data. Unknown names fall back to whatever image the API
// sent, then to the name in text — see the call sites.
const RANK_SLUGS = {
  'private': 'private',
  'sergeant': 'sergeant',
  'sergeant major': 'sergeant-major',
  'second lieutenant': 'second-lieutenant',
  'first lieutenant': 'first-lieutenant',
  'captain': 'captain',
  'major': 'major',
  'colonel': 'colonel',
  'general': 'general',
  '1 star general': 'general-1-star',
  '2 star general': 'general-2-star',
  '3 star general': 'general-3-star',
  '4 star general': 'general-4-star',
  '5 star general': 'general-5-star',
}

// A local insignia PNG for `rank`, or null when the name isn't one we have.
// Accepts "3 Star General" and "3* General" alike.
export function rankIcon(rank) {
  if (!rank) return null
  const key = String(rank).toLowerCase().replace(/\*/g, ' star ').replace(/\s+/g, ' ').trim()
  const slug = RANK_SLUGS[key]
  return slug ? asset(`design/ranks/${slug}.png`) : null
}
