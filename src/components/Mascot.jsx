import { useEffect } from 'react'

// A friendly Tzivos Hashem soldier (SVG), for the celebration pop-up.
function SoldierFace({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
      {/* cap */}
      <path d="M12 26c0-9 9-15 20-15s20 6 20 15z" fill="#375024" />
      <rect x="10" y="25" width="44" height="7" rx="3.5" fill="#2c3f20" />
      <path d="M27 15l5-2 5 2-5 2z" fill="#e6b422" />
      <circle cx="32" cy="20" r="2.4" fill="#e6b422" />
      {/* face */}
      <circle cx="32" cy="40" r="15" fill="#f3d3ad" />
      <circle cx="26" cy="39" r="2" fill="#2c3f20" />
      <circle cx="38" cy="39" r="2" fill="#2c3f20" />
      <path d="M26 45c2 3 10 3 12 0" fill="none" stroke="#2c3f20" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Slides up briefly with an encouraging message, then dismisses itself.
export default function Mascot({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone, message])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="animate-rise flex items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-card ring-1 ring-white/10">
        <SoldierFace />
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">{message}</p>
          <p className="font-cond text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Tzivos Hashem</p>
        </div>
        <span className="animate-shake text-3xl">🌿</span>
      </div>
    </div>
  )
}
