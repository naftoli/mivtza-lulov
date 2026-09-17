export function fmt(n) {
  return new Intl.NumberFormat('en-US').format(n || 0)
}

// When a school's city is shown underneath, drop that location from the name
// so it isn't repeated (e.g. "Cheder Menachem LA" → "Cheder Menachem").
const CITY_ALIASES = { 'Los Angeles': ['LA'] }
export function shortSchoolName(school) {
  const name = school?.name || ''
  const loc = (school?.city || '').split(',')[0].trim()
  if (!loc) return name
  const tokens = [loc, ...(CITY_ALIASES[loc] || [])]
  let out = name
  for (const t of tokens) out = out.replace(new RegExp(`\\s*\\b${t}\\b`, 'ig'), ' ')
  out = out.replace(/\s{2,}/g, ' ').trim()
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

export function daysLeft(endDate) {
  const end = new Date(endDate + 'T23:59:59')
  const diff = end.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
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
