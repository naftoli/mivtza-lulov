import { Link } from 'react-router-dom'

// The signature five-colour Tzivos Hashem brand band.
export function Band({ className = '' }) {
  return (
    <div className={`band ${className}`} aria-hidden="true">
      <i /><i /><i /><i /><i />
    </div>
  )
}

// Masthead logo lockup: real TH emblem + wordmark.
export function Brand({ size = 46, dark = false }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/th-logo.svg" alt="Tzivos Hashem" style={{ height: size, width: 'auto' }} className="shrink-0" />
      <span className="leading-none">
        <span className="block font-display text-[1.15rem] font-normal" style={{ color: dark ? '#fff' : 'var(--color-navy)' }}>
          Mivtza Lulav
        </span>
        <span className="mt-0.5 block font-cond text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
          style={{ color: dark ? '#c9d6ef' : 'var(--color-muted)' }}>
          Tzivos Hashem
        </span>
      </span>
    </span>
  )
}

// School logo — uses an uploaded logo if present, else an initials monogram.
export function SchoolLogo({ school, size = 56, className = '' }) {
  const initials = school.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  if (school.logo) {
    return (
      <span
        style={{ height: size, width: size }}
        className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-line ${className}`}
      >
        <img src={school.logo} alt={school.name} className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  return (
    <span
      style={{ height: size, width: size, background: school.color || 'var(--color-navy)' }}
      className={`grid shrink-0 place-items-center rounded-xl font-cond font-bold uppercase text-white shadow-sm ${className}`}
    >
      <span style={{ fontSize: size * 0.36, letterSpacing: '0.02em' }}>{initials}</span>
    </span>
  )
}

// `topColor` is accepted for call-site compatibility but intentionally not
// rendered in this theme — the old design used clean cards with no top bar.
// Profile picture: the kid's photo if we have one, else a colored initials
// circle. (Real photos arrive from Mashpia; initials are the stand-in.)
const AVATAR_BG = ['#46662b', '#c8951a', '#2f6f5f', '#375024', '#8a6d1f', '#1b4fd8']
export function Avatar({ name = '', src, size = 40, className = '' }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (src) {
    return <img src={src} alt={name} style={{ height: size, width: size }} className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`} />
  }
  const bg = AVATAR_BG[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length]
  return (
    <span style={{ height: size, width: size, background: bg }} className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ring-1 ring-black/5 ${className}`}>
      <span style={{ fontSize: size * 0.4 }}>{initials || '🎖️'}</span>
    </span>
  )
}

export function Card({ className = '', topColor, children }) {
  void topColor
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-card shadow-card ${className}`}>
      {children}
    </div>
  )
}

const btnClass = {
  primary: 'btn btn-p',
  gold: 'btn btn-p',
  blue: 'btn btn-s',
  navy: 'btn btn-navy',
  red: 'btn btn-red',
  outline: 'btn btn-o',
  outlineWhite: 'btn btn-o-white',
  ghost: 'btn btn-ghost',
}

export function Button({ variant = 'primary', className = '', as, to, ...props }) {
  const cls = `${btnClass[variant] || btnClass.primary} ${className}`
  if (to) return <Link to={to} className={cls} {...props} />
  const Comp = as || 'button'
  return <Comp className={cls} {...props} />
}

export function SectionHeader({ children, className = '' }) {
  return <p className={`sh ${className}`}>{children}</p>
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-cond text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted/80">{hint}</span>}
    </label>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25 ${props.className || ''}`}
    />
  )
}

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25 ${props.className || ''}`}
    />
  )
}

export function Pill({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-track px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted ${className}`}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-blue" />
      <span className="font-cond text-sm font-semibold uppercase tracking-wide">{label}</span>
    </div>
  )
}
