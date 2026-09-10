import { fmt, shortSchoolName } from './format.js'

// Word-wrap a string into up to `maxLines` lines of ~`per` chars.
function wrap(text, per, maxLines) {
  const words = String(text).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > per && cur) { lines.push(cur); cur = w }
    else cur = (cur + ' ' + w).trim()
    if (lines.length === maxLines - 1 && cur.length > per) break
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…' }
  return lines.slice(0, maxLines)
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Build a 1080×1080 shareable campaign card as an SVG string.
export function buildShareSVG(school) {
  const { name, city, color = '#46662b', logo, total, activeGoal, percent, bonusActive } = school
  const nameLines = wrap(shortSchoolName(school), 20, 2)
  const barW = 936
  const fillW = Math.max(24, Math.round((barW * Math.min(percent, 100)) / 100))
  const nameY = nameLines.length > 1 ? 176 : 200

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="hd" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2c3f20"/><stop offset="1" stop-color="#16210f"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="#faf7ee"/>
  <rect width="1080" height="360" fill="url(#hd)"/>
  <rect x="72" y="96" width="168" height="168" rx="22" fill="#ffffff"/>
  ${logo ? `<image x="84" y="108" width="144" height="144" preserveAspectRatio="xMidYMid meet" xlink:href="${logo}"/>`
      : `<text x="156" y="205" font-family="Georgia, serif" font-size="64" font-weight="bold" fill="${color}" text-anchor="middle">${esc(name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase())}</text>`}
  <text x="272" y="128" font-family="Arial, sans-serif" font-size="26" letter-spacing="5" fill="#e6b422">MIVTZA LULAV</text>
  ${nameLines.map((l, i) => `<text x="272" y="${nameY + i * 62}" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="#ffffff">${esc(l)}</text>`).join('\n  ')}
  <text x="272" y="${nameY + nameLines.length * 62 + 6}" font-family="Arial, sans-serif" font-size="26" fill="#c9d6bf">${esc(city || 'Tzivos Hashem')}</text>

  <text x="72" y="470" font-family="Arial, sans-serif" font-size="28" letter-spacing="3" fill="#5f6a4a">TOTAL SHAKES${bonusActive ? ' · BONUS ROUND' : ''}</text>
  <text x="72" y="580" font-family="Georgia, serif" font-size="120" font-weight="bold" fill="#2c3f20">${fmt(total)}</text>
  <text x="1008" y="580" font-family="Georgia, serif" font-size="120" font-weight="bold" fill="${color}" text-anchor="end">${percent}%</text>
  <text x="72" y="628" font-family="Arial, sans-serif" font-size="34" fill="#5f6a4a">of ${fmt(activeGoal)} shakes</text>

  <rect x="72" y="680" width="${barW}" height="44" rx="22" fill="#ece4d1"/>
  <rect x="72" y="680" width="${fillW}" height="44" rx="22" fill="${color}"/>

  <text x="540" y="856" font-family="Georgia, serif" font-size="44" fill="#2c3f20" text-anchor="middle">Help ${esc(nameLines[0])} reach their goal! 🌿</text>
  <text x="540" y="912" font-family="Arial, sans-serif" font-size="28" fill="#5f6a4a" text-anchor="middle">Every Yid, one more mitzvah</text>

  <rect x="0" y="1000" width="1080" height="80" fill="#24331c"/>
  <text x="540" y="1050" font-family="Arial, sans-serif" font-size="28" letter-spacing="3" fill="#e6b422" text-anchor="middle">TZIVOS HASHEM · SUKKOS 5787</text>
</svg>`
}

// Rasterize an SVG string to a PNG Blob (for sharing / download).
export function svgToPngBlob(svgString, scale = 1) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1080 * scale
      canvas.height = 1080 * scale
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg load failed')) }
    img.src = url
  })
}
