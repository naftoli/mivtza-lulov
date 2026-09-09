import { useState } from 'react'
import { timeAgo } from '../lib/format.js'
import { Card, SectionHeader } from './ui.jsx'

// Gallery of photos kids uploaded from the field ("Mivtzoim Pictures").
export default function PhotoWall({ shakes }) {
  // one tile per photo (an entry can carry several)
  const photos = shakes.flatMap((s) => {
    const imgs = s.photos?.length ? s.photos : s.photo ? [s.photo] : []
    return imgs.map((img, i) => ({ ...s, photo: img, id: `${s.id}-${i}` }))
  })
  const [active, setActive] = useState(null)

  if (photos.length === 0) return null

  return (
    <Card className="p-5" topColor="var(--color-cyan)">
      <SectionHeader className="mb-4">Mivtzoim Pictures</SectionHeader>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((s) => (
          <button key={s.id} onClick={() => setActive(s)}
            className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-line">
            <img src={s.photo} alt={s.note || 'shake photo'} className="h-full w-full object-cover transition group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-1 text-left font-cond text-[10px] font-semibold uppercase tracking-wide text-white">
              {s.kidName}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,16,34,.92)] p-4" onClick={() => setActive(null)}>
          <div className="max-w-lg overflow-hidden rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            <img src={active.photo} alt="" className="max-h-[70vh] w-full bg-navy-dark object-contain" />
            <div className="p-4">
              <p className="font-semibold text-navy">{active.kidName} · {active.count} shakes</p>
              {active.note && <p className="text-sm italic text-muted">“{active.note}”</p>}
              <p className="mt-1 font-cond text-[11px] uppercase tracking-[0.08em] text-muted/70">{timeAgo(active.createdAt)}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
