import { useEffect, useRef, useState } from 'react'
import { useDialog } from '../lib/useDialog.js'
import { timeAgo } from '../lib/format.js'
import { approvedPhotos } from '../lib/photos.js'
import { Card, SectionHeader } from './ui.jsx'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'

// Gallery of photos kids uploaded from the field ("Mivtzoim Pictures"): three
// across, moved by the arrows or a swipe on a phone. It loops, so it never runs
// out and the arrows never dead-end. shadcn/ui's Carousel over Embla.
export default function PhotoWall({ shakes }) {
  // one slide per photo (an entry can carry several) — only APPROVED photos show,
  // picked per photo so a day's newer pending photo stays off the wall
  const photos = shakes.flatMap((s) =>
    approvedPhotos(s).map((img, i) => ({ ...s, photo: img, id: `${s.id}-${i}` })))
  const count = photos.length
  const [active, setActive] = useState(null)
  const [api, setApi] = useState(null)

  // A newly approved photo lengthens the list under the carousel.
  useEffect(() => { api?.reInit() }, [api, count])

  if (count === 0) return null

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader className="mb-4">Mivtzoim Pictures</SectionHeader>

      {/* The arrows sit inside the frame rather than shadcn's default -left-12 /
          -right-12, which would hang them off the card. */}
      <Carousel setApi={setApi} opts={{ loop: true, align: 'start' }} className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {photos.map((s, i) => (
            <CarouselItem key={s.id} className="basis-1/3 pl-2 md:pl-4">
              <figure>
                <button type="button" onClick={() => setActive(s)}
                  aria-label={`View photo ${i + 1} of ${count} from ${s.kidName} full size`}
                  className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-mid">
                  <img src={s.photo} alt={s.note || 'shake photo'} loading={i < 3 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover transition group-hover:scale-105" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-2 pb-1.5 pt-6 text-left text-[10px] font-semibold uppercase tracking-wide text-white sm:text-xs">
                    {s.kidName}
                  </figcaption>
                </button>
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>
        {count > 3 && (
          <>
            <CarouselPrevious className="left-1 size-9 border-0 bg-white/95 text-green shadow-md ring-1 ring-navy/10 hover:bg-white sm:-left-4" />
            <CarouselNext className="right-1 size-9 border-0 bg-white/95 text-green shadow-md ring-1 ring-navy/10 hover:bg-white sm:-right-4" />
          </>
        )}
      </Carousel>

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
