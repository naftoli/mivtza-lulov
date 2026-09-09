import { useEffect, useRef, useState } from 'react'
import { buildShareSVG, svgToPngBlob } from '../lib/shareCard.js'
import { Button, SectionHeader } from './ui.jsx'
import QrCode from './QrCode.jsx'

// Modal: a shareable campaign card (image) + QR code + share actions.
export default function SharePanel({ school, onClose }) {
  const url = window.location.href
  const [png, setPng] = useState(null) // { blob, dataUrl }
  const [toast, setToast] = useState('')
  const blobRef = useRef(null)

  useEffect(() => {
    let alive = true
    const svg = buildShareSVG(school)
    svgToPngBlob(svg).then((blob) => {
      blobRef.current = blob
      const dataUrl = URL.createObjectURL(blob)
      if (alive) setPng({ blob, dataUrl })
    }).catch(() => setToast('Could not build the image.'))
    return () => { alive = false; if (png?.dataUrl) URL.revokeObjectURL(png.dataUrl) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.id])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1800) }
  const shareText = `Help ${school.name} reach their Mivtza Lulav goal! 🌿`

  async function shareImage() {
    const blob = blobRef.current
    const file = blob && new File([blob], 'mivtza-lulav.png', { type: 'image/png' })
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: school.name, text: shareText, url }) } catch { /* cancelled */ }
    } else if (navigator.share) {
      try { await navigator.share({ title: school.name, text: shareText, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareText} ${url}`)
      flash('Link copied — paste it anywhere!')
    }
  }

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`, '_blank', 'noopener')
  }

  function download() {
    if (!png) return
    const a = document.createElement('a')
    a.href = png.dataUrl
    a.download = `mivtza-lulav-${school.id}.png`
    document.body.appendChild(a); a.click(); a.remove()
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    flash('Link copied!')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,16,34,.6)] p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeader>Share this campaign</SectionHeader>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-track text-muted hover:bg-line">✕</button>
        </div>

        {/* Card preview */}
        <div className="overflow-hidden rounded-xl ring-1 ring-line">
          {png ? <img src={png.dataUrl} alt="Share card" className="w-full" />
            : <div className="aspect-square w-full animate-pulse bg-track" />}
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="gold" onClick={shareImage} className="w-full">↗ Share</Button>
          <Button variant="navy" onClick={whatsapp} className="w-full">WhatsApp</Button>
          <Button variant="outline" onClick={download} className="w-full">⬇ Save image</Button>
          <Button variant="outline" onClick={copyLink} className="w-full">Copy link</Button>
        </div>

        {/* QR */}
        <div className="mt-5 flex items-center gap-4 rounded-xl bg-paper p-4">
          <QrCode value={url} size={110} />
          <div>
            <p className="font-semibold text-navy">Scan to open</p>
            <p className="text-sm text-muted">Great for flyers, signs, or sharing in person.</p>
          </div>
        </div>

        {toast && <p className="mt-3 text-center font-cond text-sm font-semibold uppercase text-green">{toast}</p>}
      </div>
    </div>
  )
}
