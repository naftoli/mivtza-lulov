import { useEffect, useRef, useState } from 'react'
import { buildShareCard, shareCardFile, canShareFiles } from '../lib/shareCard.js'
import { asset } from '../lib/asset.js'
import { useDialog } from '../lib/useDialog.js'
import { Button, SectionHeader } from './ui.jsx'

// Modal: a shareable campaign card (image) + share actions.
export default function SharePanel({ school, onClose }) {
  const url = window.location.href
  const [png, setPng] = useState(null) // { blob, dataUrl }
  const [toast, setToast] = useState('')
  const blobRef = useRef(null)
  const dialogRef = useRef(null)
  useDialog(dialogRef, onClose)

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

  const flash = (m, ms = 1800) => { setToast(m); setTimeout(() => setToast(''), ms) }
  const COPY_FAILED = 'Couldn’t copy automatically — copy the link from your address bar.'

  // navigator.clipboard is missing on plain-http pages and in some in-app
  // browsers, and writeText rejects where the browser blocks it — never throw.
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }
  const shareText = `Help ${school.name} reach their Mivtza Lulav goal!`

  // Share the generated share-card PNG + the link through the native share
  // sheet where the browser supports file-sharing; otherwise share the link
  // alone, and as a last resort copy it to the clipboard.
  async function shareImage() {
    const file = shareCardFile(blobRef.current, school)
    if (canShareFiles(file)) {
      try { await navigator.share({ files: [file], title: school.name, text: shareText, url }) } catch { /* cancelled */ }
    } else if (navigator.share) {
      try { await navigator.share({ title: school.name, text: shareText, url }) } catch { /* cancelled */ }
    } else if (await copyText(`${shareText} ${url}`)) {
      flash('Link copied — paste it anywhere!')
    } else {
      flash(COPY_FAILED, 4000)
    }
  }

  // WhatsApp: attach the photo + link through the native share sheet where the
  // browser can share files (Android Chrome, iOS Safari), otherwise fall back
  // to a wa.me link carrying the message + URL. A wa.me link can't attach the
  // image itself — on that path the user gets the link and can add the saved
  // image manually.
  async function whatsapp() {
    const file = shareCardFile(blobRef.current, school)
    if (canShareFiles(file)) {
      try {
        await navigator.share({ files: [file], title: school.name, text: `${shareText} ${url}` })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return // user dismissed the sheet
        // any other error → fall through to the wa.me link
      }
    }
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
    if (await copyText(url)) flash('Link copied!')
    else flash(COPY_FAILED, 4000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,28,76,0.55)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Share this campaign" tabIndex={-1}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-card p-5 shadow-card outline-none sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionHeader className="flex items-center gap-2">
            <img src={asset('design/lulav-esrog.png')} alt="" className="h-5 w-auto" />
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

        {toast && <p className="mt-4 text-center text-sm font-semibold text-green">{toast}</p>}
      </div>
    </div>
  )
}
