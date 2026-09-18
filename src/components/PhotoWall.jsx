import { useRef, useState } from 'react'
import { useDialog } from '../lib/useDialog.js'
import { timeAgo } from '../lib/format.js'
import { approvedPhotos } from '../lib/photos.js'
import { Card, SectionHeader, Button } from './ui.jsx'

const PHOTO_BATCH = 10

// Gallery of photos kids uploaded from the field ("Mivtzoim Pictures").
export default function PhotoWall({ shakes }) {
  // one tile per photo (an entry can carry several) — only APPROVED photos show,
  // picked per photo so a day's newer pending photo stays off the wall
  const photos = shakes.flatMap((s) =>
    approvedPhotos(s).map((img, i) => ({ ...s, photo: img, id: `${s.id}-${i}` })))
  const [active, setActive] = useState(null)
  const [visible, setVisible] = useState(PHOTO_BATCH)

  if (photos.length === 0) return null

  const shown = photos.slice(0, visible)

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader className="mb-4">Mivtzoim Pictures</SectionHeader>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {shown.map((s) => (
          <button key={s.id} onClick={() => setActive(s)}
            className="group relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-navy/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-mid">
            <img src={s.photo} alt={s.note || 'shake photo'} className="h-full w-full object-cover transition group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/75 to-transparent px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white">
              {s.kidName}
            </span>
          </button>
        ))}
      </div>

      {photos.length > visible && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PHOTO_BATCH)}>
            Load More
          </Button>
        </div>
      )}

      <PhotoLightbox photo={active} onClose={() => setActive(null)} />
    </Card>
  )
}

// Full-size viewer for one photo. `photo` is a shake entry with a single `photo`
// URL picked out (see the flatMap above); shared with the admin approval card.
export function PhotoLightbox({ photo: active, onClose }) {
  const ref = useRef(null)
  useDialog(ref, onClose, !!active)
  if (!active) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/90 p-4" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={`Photo from ${active.kidName}`} tabIndex={-1}
        className="relative max-w-lg overflow-hidden rounded-[28px] bg-white shadow-hover outline-none" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close photo"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-green shadow transition hover:bg-white">✕</button>
        <img src={active.photo} alt="" className="max-h-[70vh] w-full bg-navy object-contain" />
        <div className="p-4 sm:p-5">
          <p className="font-semibold text-navy">{active.kidName} · <span className="text-green">{active.count} shakes</span></p>
          {active.note && <p className="text-sm italic text-navy/70">“{active.note}”</p>}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/55">{timeAgo(active.createdAt)}</p>
        </div>
      </div>
    </div>
  )
}
