import { useEffect, useRef, useState } from 'react'
import { buildShareCard } from '../lib/shareCard.js'
import { asset } from '../lib/asset.js'
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
    let objectUrl = null
    buildShareCard(school).then((blob) => {
      if (!alive) return
      blobRef.current = blob
      objectUrl = URL.createObjectURL(blob)
      setPng({ blob, dataUrl: objectUrl })
    }).catch(() => { if (alive) setToast('Could not build the image.') })
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,28,76,0.55)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-card p-5 shadow-card sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionHeader className="flex items-center gap-2">
            <img src={asset('design/lulav-esrog-small.png')} alt="" className="h-5 w-auto" />
            Share this campaign
          </SectionHeader>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-9 w-9 flex-none place-items-center rounded-full bg-track text-green transition hover:bg-line">✕</button>
        </div>

        {/* Card preview */}
        <div className="overflow-hidden rounded-[20px] bg-track">
          {png ? <img src={png.dataUrl} alt="Share card" className="block w-full" />
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
        <div className="mt-5 flex items-center gap-4 rounded-[20px] bg-paper p-4">
          <QrCode value={url} size={110} className="flex-none" />
          <div className="min-w-0">
            <p className="font-display font-bold text-navy">Scan to open</p>
            <p className="text-sm text-muted">Great for flyers, signs, or sharing in person.</p>
          </div>
        </div>

        {toast && <p className="mt-3 text-center text-sm font-semibold text-green">{toast}</p>}
      </div>
    </div>
  )
}
