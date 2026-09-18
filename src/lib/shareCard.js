import { fmt, shortSchoolName } from './format.js'
import { asset } from './asset.js'
import { CAMPAIGN_YEAR } from './succos.js'

// Shareable 1080×1080 campaign card in the redesign palette: a green-deep
// header panel (school logo, name, gold eyebrow) over a sky card on mint with
// navy/green numbers, the track+green progress bar with the lulav-esrog
// marker, and the TH shield beside the gold wordmark in the footer band.
//
// It is drawn straight onto a canvas (not rasterized from an SVG string) so
// the page's web fonts (Exo / Bebas Neue) are used and images load through
// the same base-aware asset() path as the rest of the site.
const SIZE = 1080

// Palette mirrors the @theme tokens in src/index.css. Tailwind v4 only emits
// the CSS variables that are actually used, so every read has the token's
// own value as its fallback.
function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

function palette() {
  return {
    mint: token('--color-mint', '#deedda'),
    sky: token('--color-sky', '#c3ecff'),
    track: token('--color-track', '#9eddf9'),
    navy: token('--color-navy', '#001c4c'),
    muted: token('--color-muted', '#3a4d78'),
    green: token('--color-green', '#094b26'),
    greenLight: token('--color-green-light', '#68c07b'),
    greenFillEnd: '#3f9a55', // dark end of --grad-progress
    gold: token('--color-gold', '#ffde49'),
  }
}

const EXO = 'Exo, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
const COND = '"Bebas Neue", "Arial Narrow", Impact, sans-serif'
const exo = (weight, px, italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px ${EXO}`
const cond = (px) => `400 ${px}px ${COND}`

// ---- asset loading (cached across opens of the share panel) ----
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const cache = new Map()
function cached(key, loader) {
  if (!cache.has(key)) {
    cache.set(key, loader().then((img) => {
      if (!img) cache.delete(key) // let a failed load retry next time
      return img
    }))
  }
  return cache.get(key)
}

// th-logo.svg carries only a viewBox; give it explicit dimensions so every
// browser rasterizes it through drawImage at the size we ask for.
function loadShield() {
  return cached('shield', async () => {
    try {
      const res = await fetch(asset('th-logo.svg'))
      if (!res.ok) return null
      let svg = await res.text()
      if (!/<svg\b[^>]*\swidth=/i.test(svg)) svg = svg.replace(/<svg\b/i, '<svg width="999" height="899"')
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      const img = await loadImage(url)
      URL.revokeObjectURL(url)
      return img
    } catch {
      return null
    }
  })
}

const loadMarker = () => cached('marker', () => loadImage(asset('design/lulav-esrog.png')))

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  const faces = [exo(900, 116), exo(900, 52), exo(700, 42, true), exo(600, 34), exo(600, 26), exo(400, 28), cond(30)]
  await Promise.allSettled(faces.map((f) => document.fonts.load(f)))
}

// ---- drawing helpers ----
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Word-wrap by measured width (uses the font currently set on ctx). When
// `maxLines` is given the overflow is cut and the last line gets an ellipsis.
function wrap(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(next).width > maxWidth) { lines.push(cur); cur = w }
    else cur = next
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines.length = maxLines
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd()
    lines[maxLines - 1] = `${last}…`
  }
  return lines
}

// Largest size (stepping down by 2px) at which `text` wraps into at most
// `maxLines` lines that all fit `maxWidth`; falls back to the minimum size
// with an ellipsis.
function fitLines(ctx, text, fontOf, maxPx, minPx, maxWidth, maxLines) {
  for (let px = maxPx; px >= minPx; px -= 2) {
    ctx.font = fontOf(px)
    const lines = wrap(ctx, text, maxWidth)
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { px, lines }
  }
  ctx.font = fontOf(minPx)
  return { px: minPx, lines: wrap(ctx, text, maxWidth, maxLines) }
}

// Largest single-line size at which `text` fits `maxWidth`.
function fitPx(ctx, text, fontOf, maxPx, minPx, maxWidth) {
  for (let px = maxPx; px > minPx; px -= 2) {
    ctx.font = fontOf(px)
    if (ctx.measureText(text).width <= maxWidth) return px
  }
  return minPx
}

function setSpacing(ctx, value) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = value
}

// Build the share card and resolve with a PNG Blob (for preview / share / save).
export async function buildShareCard(school) {
  const { name, city, total, goal, percent, bonusActive, bonusLevel } = school
  const p = palette()
  const [, shield, marker] = await Promise.all([ensureFonts(), loadShield(), loadMarker()])

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // mint page
  ctx.fillStyle = p.mint
  ctx.fillRect(0, 0, SIZE, SIZE)

  // ---- header panel (green-deep glass) ----
  roundRect(ctx, 40, 40, 1000, 330, 40)
  ctx.fillStyle = p.green
  ctx.fill()

  // school logo tile
  roundRect(ctx, 80, 90, 150, 150, 22)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  // Initials monogram — schools carry no logo image (see SchoolLogo).
  const initials = String(name || '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  ctx.font = exo(900, 60)
  ctx.fillStyle = p.navy
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials, 155, 167)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // eyebrow — gold on green-deep
  ctx.font = exo(600, 26)
  ctx.fillStyle = p.gold
  setSpacing(ctx, '2.6px')
  ctx.fillText('MIVTZA LULAV', 262, 126)
  setSpacing(ctx, '0px')

  // school name — Exo Black, white, up to two lines
  const nameMaxW = 1000 - 262
  const { px: namePx, lines: nameLines } = fitLines(ctx, shortSchoolName(school), (s) => exo(900, s), 52, 36, nameMaxW, 2)
  ctx.font = exo(900, namePx)
  ctx.fillStyle = '#ffffff'
  const nameLH = Math.round(namePx * 1.12)
  const nameY = nameLines.length > 1 ? 184 : 200
  nameLines.forEach((l, i) => ctx.fillText(l, 262, nameY + i * nameLH))

  // city
  ctx.font = exo(400, 28)
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText(city || 'Tzivos Hashem', 262, nameY + (nameLines.length - 1) * nameLH + 46)

  // ---- sky card ----
  roundRect(ctx, 40, 400, 1000, 640, 40)
  ctx.fillStyle = p.sky
  ctx.fill()

  const L = 96
  const R = 984
  const W = R - L

  // label
  ctx.font = exo(600, 26)
  ctx.fillStyle = p.navy
  setSpacing(ctx, '2px')
  ctx.fillText(`TOTAL SHAKES${bonusActive ? ` · BONUS ROUND ${bonusLevel}` : ''}`, L, 478)
  setSpacing(ctx, '0px')

  // big numbers — total left, percent right, both green-deep
  ctx.font = exo(900, 116)
  ctx.fillStyle = p.green
  ctx.fillText(fmt(total), L, 600)
  ctx.textAlign = 'right'
  ctx.fillText(`${percent}%`, R, 600)
  ctx.textAlign = 'left'

  // goal line — navy
  ctx.font = exo(600, 34)
  ctx.fillStyle = p.navy
  ctx.fillText(`of ${fmt(goal)} shakes`, L, 652)

  // progress bar — track + green gradient fill + lulav-esrog marker
  const barY = 770
  const barH = 44
  roundRect(ctx, L, barY, W, barH, barH / 2)
  ctx.fillStyle = p.track
  ctx.fill()
  const fillW = Math.max(barH, Math.round((W * Math.min(percent, 100)) / 100))
  const grad = ctx.createLinearGradient(L, 0, L + fillW, 0)
  grad.addColorStop(0, p.greenLight)
  grad.addColorStop(1, p.greenFillEnd)
  roundRect(ctx, L, barY, fillW, barH, barH / 2)
  ctx.fillStyle = grad
  ctx.fill()
  if (marker) {
    const mw = marker.naturalWidth || 38
    const mh = marker.naturalHeight || 150
    const cx = Math.min(Math.max(L + fillW - 10, L + mw / 2), R - mw / 2)
    ctx.drawImage(marker, Math.round(cx - mw / 2), barY + barH + 4 - mh, mw, mh)
  }

  // tagline — Exo Bold Italic navy, shrunk to fit the card width, closed by the
  // lulav-and-esrog mark (the bar-marker render, scaled down). An emoji here would
  // be drawn in whatever emoji font the phone has; the brand art is drawn instead.
  const tag = `Help ${nameLines[0]} reach their goal!`
  const iconRoom = marker ? 36 : 0 // gap + icon width at the largest size
  const tagPx = fitPx(ctx, tag, (s) => exo(700, s, true), 42, 26, W - iconRoom)
  ctx.font = exo(700, tagPx, true)
  ctx.fillStyle = p.navy
  if (marker) {
    const ih = Math.round(tagPx * 1.3)
    const iw = Math.round((ih * (marker.naturalWidth || 38)) / (marker.naturalHeight || 150))
    const gap = Math.round(tagPx * 0.35)
    const tw = ctx.measureText(tag).width
    const x0 = Math.round(SIZE / 2 - (tw + gap + iw) / 2)
    ctx.textAlign = 'left'
    ctx.fillText(tag, x0, 884)
    ctx.drawImage(marker, Math.round(x0 + tw + gap), 884 + Math.round(tagPx * 0.2) - ih, iw, ih)
  } else {
    ctx.textAlign = 'center'
    ctx.fillText(tag, SIZE / 2, 884)
  }
  ctx.textAlign = 'center'
  ctx.font = exo(400, 28)
  ctx.fillStyle = p.muted
  ctx.fillText('Every Yid, one more mitzvah', SIZE / 2, 928)
  ctx.textAlign = 'left'

  // ---- footer band (green-deep, clipped to the card's rounded bottom) ----
  const footY = 966
  const footH = 1040 - footY
  ctx.save()
  roundRect(ctx, 40, 400, 1000, 640, 40)
  ctx.clip()
  ctx.fillStyle = p.green
  ctx.fillRect(40, footY, 1000, footH)
  ctx.restore()

  ctx.font = cond(30)
  ctx.fillStyle = p.gold
  setSpacing(ctx, '1.8px')
  const label = `TZIVOS HASHEM · SUKKOS ${CAMPAIGN_YEAR}`
  const labelW = ctx.measureText(label).width
  const shieldH = 46
  const shieldW = shield ? Math.round(shieldH * ((shield.naturalWidth || 999) / (shield.naturalHeight || 899))) : 0
  const gap = shield ? 16 : 0
  const startX = Math.round((SIZE - (shieldW + gap + labelW)) / 2)
  if (shield) ctx.drawImage(shield, startX, footY + (footH - shieldH) / 2, shieldW, shieldH)
  ctx.textBaseline = 'middle'
  ctx.fillText(label, startX + shieldW + gap, footY + footH / 2 + 1)
  ctx.textBaseline = 'alphabetic'
  setSpacing(ctx, '0px')

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png')
  })
}

// ---- Web Share helpers (used by SharePanel for the Share + WhatsApp buttons) ----

// Wrap a rendered share-card PNG blob in a File for the Web Share API.
export function shareCardFile(blob, school) {
  if (!blob) return null
  return new File([blob], `mivtza-lulav-${school?.id ?? 'card'}.png`, { type: 'image/png' })
}

// True when this browser can share the given file through the Web Share API
// (navigator.canShare with a files payload — Android Chrome, iOS Safari).
// Guards for SSR / older browsers that lack canShare.
export function canShareFiles(file) {
  try {
    return !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })
  } catch {
    return false
  }
}
