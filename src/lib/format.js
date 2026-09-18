export function fmt(n) {
  return new Intl.NumberFormat('en-US').format(n || 0)
}

// When a school's city is shown underneath, drop that location from the name
// so it isn't repeated (e.g. "Cheder Menachem LA" → "Cheder Menachem").
//
// This used to build `new RegExp(\`\\s*\\b${city}\\b\`)` from the raw city.
// school_city is free text out of the Mashpia database, so that was a crash
// waiting to happen: a city containing "(", "[", "+" or "*" throws a
// SyntaxError, and because this runs during render it would have blanked the
// home page and every school page. Three live schools already carry a "."
// ("L. A.", "S.Paulo" twice) — those compiled, but "." matched any character,
// so the match was wrong as well as fragile. The \b boundaries were no better:
// they need a word character on the far side, which "L. A." does not have.
//
// Comparing on normalized words instead means no regex is built from user
// data at all, and punctuation and spacing differences stop mattering:
// "L. A." and "LA" both reduce to "la", "S.Paulo" and "S Paulo" to "spaulo".
const normalizeToken = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

// Extra spellings to strip for a given city, keyed by its normalized form.
// A Map, not an object literal: `loc` is user data, and a city named
// "constructor" would otherwise pull a value off Object.prototype.
const CITY_ALIASES = new Map([
  ['losangeles', ['LA']],
  ['la', ['Los Angeles']],
])

// Removes the first run of consecutive words in `name` that spells `loc`,
// ignoring case, spacing and punctuation. Returns null when there is no match.
function stripLocation(name, loc) {
  const target = normalizeToken(loc)
  if (!target) return null
  const words = name.split(/\s+/).filter(Boolean)
  for (let start = 0; start < words.length; start++) {
    let run = ''
    for (let end = start; end < words.length; end++) {
      run += normalizeToken(words[end])
      if (run === target) return [...words.slice(0, start), ...words.slice(end + 1)].join(' ')
      if (run.length >= target.length) break // a longer run can only overshoot
    }
  }
  return null
}

export function shortSchoolName(school) {
  const name = school?.name || ''
  const loc = (school?.city || '').split(',')[0].trim()
  if (!loc) return name
  let out = name
  for (const token of [loc, ...(CITY_ALIASES.get(normalizeToken(loc)) || [])]) {
    out = stripLocation(out, token) ?? out
  }
  // Collapse whitespace, as the previous implementation did: removing a run of
  // words leaves a double space behind, and a few school names carry one in
  // the source data anyway.
  out = out.replace(/\s{2,}/g, ' ').trim()
  // Never blank the name out entirely — a school called just "Brooklyn" in
  // Brooklyn keeps its name rather than rendering as an empty heading.
  return out || name
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

// The Hebrew-calendar date for an ISO timestamp, e.g. "24 Tishri 5787".
// Date only — no time/seconds. Guarded so a bad value never throws in render.
export function hebrewDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-u-ca-hebrew', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

// Downscale an uploaded image to a data URL so the mock localStorage store
// doesn't blow its quota. The real backend would upload the original file.
export function fileToScaledDataUrl(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
