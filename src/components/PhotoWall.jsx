import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import { useDialog } from '../lib/useDialog.js'
import { timeAgo } from '../lib/format.js'
import { approvedPhotos } from '../lib/photos.js'
import { Card, SectionHeader } from './ui.jsx'

// Someone who has asked their system to cut animation gets the carousel
// standing still; the arrows, the dots and the swipe all still work.
const wantsStillness = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Gallery of photos kids uploaded from the field ("Mivtzoim Pictures"): one big
// picture at a time, drifting on its own, with arrows either side and a swipe on
// a phone — the way the rank carousel works on the parent site. It loops, so it
// never runs out and the arrows never dead-end.
export default function PhotoWall({ shakes }) {
  // one slide per photo (an entry can carry several) — only APPROVED photos show,
  // picked per photo so a day's newer pending photo stays off the wall
  const photos = shakes.flatMap((s) =>
    approvedPhotos(s).map((img, i) => ({ ...s, photo: img, id: `${s.id}-${i}` })))
  const count = photos.length
  const [active, setActive] = useState(null)
  const [index, setIndex] = useState(0)
  const [emblaRef, embla] = useEmblaCarousel(
    { loop: true, align: 'center' },
    // A slow, continuous drift rather than a slideshow's jump. It pauses while
    // someone is looking at a picture (hover or keyboard focus) and picks up
    // again a moment after an arrow or a swipe.
    [AutoScroll({
      speed: 0.7,
      startDelay: 1500,
      playOnInit: !wantsStillness(),
      stopOnMouseEnter: true,
      stopOnFocusIn: true,
      stopOnInteraction: false,
    })],
  )

  // Embla owns the scroll position; this only mirrors it for the counter and dots.
  useEffect(() => {
    if (!embla) return undefined
    const onSelect = () => setIndex(embla.selectedScrollSnap())
    onSelect()
    embla.on('select', onSelect).on('reInit', onSelect)
    return () => { embla.off('select', onSelect).off('reInit', onSelect) }
  }, [embla])

  // A newly approved photo lengthens the list under the carousel.
  useEffect(() => { embla?.reInit() }, [embla, count])

  // Nothing drifts behind the lightbox: the carousel holds still while a photo
  // is open and resumes once it closes.
  useEffect(() => {
    const autoScroll = embla?.plugins()?.autoScroll
    if (!autoScroll) return
    if (active) autoScroll.stop()
    else if (!wantsStillness()) autoScroll.play()
  }, [active, embla])

  const prev = useCallback(() => embla?.scrollPrev(), [embla])
  const next = useCallback(() => embla?.scrollNext(), [embla])

  if (count === 0) return null

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <SectionHeader>Mivtzoim Pictures</SectionHeader>
        <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums text-navy/55">
          {index + 1} / {count}
        </span>
      </div>

      <div className="relative" role="group" aria-roledescription="carousel" aria-label="Mivtzoim pictures">
        <div className="overflow-hidden rounded-[22px]" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {photos.map((s, i) => (
              <figure key={s.id} className="min-w-0 flex-[0_0_100%]">
                <button type="button" onClick={() => setActive(s)}
                  aria-label={`View photo ${i + 1} of ${count} from ${s.kidName} full size`}
                  className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[22px] bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-mid">
                  <img src={s.photo} alt={s.note || 'shake photo'} loading={i < 2 ? 'eager' : 'lazy'}
                    className="h-full w-full object-contain" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 to-transparent px-4 pb-3 pt-10 text-left">
                    <span className="block text-sm font-semibold text-white">{s.kidName}</span>
                    {s.note && <span className="block truncate text-xs italic text-white/85">“{s.note}”</span>}
                  </figcaption>
                </button>
              </figure>
            ))}
          </div>
        </div>

        {count > 1 && (
          <>
            <CarouselArrow side="left" onClick={prev} />
            <CarouselArrow side="right" onClick={next} />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {photos.map((s, i) => (
            <button key={s.id} type="button" onClick={() => embla?.scrollTo(i)}
              aria-label={`Go to photo ${i + 1}`} aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-green' : 'w-1.5 bg-navy/20 hover:bg-navy/40'}`} />
          ))}
        </div>
      )}

      <PhotoLightbox photo={active} onClose={() => setActive(null)} />
    </Card>
  )
}

function CarouselArrow({ side, onClick }) {
  const left = side === 'left'
  return (
    <button type="button" onClick={onClick} aria-label={left ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 pb-1 text-3xl font-bold leading-none text-green shadow-md ring-1 ring-navy/10 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-mid ${left ? 'left-2' : 'right-2'}`}>
      {left ? '‹' : '›'}
    </button>
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
