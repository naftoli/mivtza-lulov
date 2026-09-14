import { asset } from '../lib/asset.js'

// The comp's nationwide progress bar: a rounded sky track with a green
// gradient fill to `percent`, and the lulav-esrog render standing on the
// fill's end as the marker — esrog on the bar, lulav rising above it.
// (The wide arrow GoalMeter stays on the school page; this is Home-only.)
//
// The marker is the 38x150 render shown at ~0.8x on desktop (~120px, as in the
// comp — never upscaled), centred on the fill's end with the esrog hanging a
// few px below the track. It rises ~85px above the track, so give the bar
// enough top margin at the call site (or sit it under a row whose text is
// `relative z-10`, which keeps the numbers legible if the lulav lands under them).
export default function GoalBar({ percent, label = 'of goal', marker = true, className = '' }) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  return (
    <div className={`relative ${className}`}>
      <div
        className="relative h-5 w-full overflow-hidden rounded-full bg-track sm:h-6"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-label={`${p}% ${label}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${Math.max(p, 1.5)}%`, background: 'var(--grad-progress)' }}
        />
      </div>

      {marker && (
        <img
          src={asset('design/lulav-esrog.png')}
          alt=""
          aria-hidden="true"
          draggable="false"
          className="pointer-events-none absolute -bottom-[6px] h-[72px] w-auto -translate-x-1/2 select-none transition-[left] duration-1000 ease-out sm:-bottom-[10px] sm:h-[100px] lg:h-[120px]"
          style={{ left: `${p}%`, filter: 'drop-shadow(0 6px 8px rgba(0, 28, 76, 0.22))' }}
        />
      )}
    </div>
  )
}
