import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Brand, Button } from './ui.jsx'
import { asset } from '../lib/asset.js'
import { useAuth } from '../context/AuthContext.jsx'

// Nav text: condensed caps in green-deep; the active page gets a green-mid underline.
// 30px from 2xl is the comp's size; lg/xl sit at ~85% of it.
// Desktop nav item: no background by default; the page you're on gets the green
// pill (the "you are here" — replaces the old underline), and every item shares
// one hover, a soft green wash. Consistent across all four links.
const navItem = ({ isActive }) =>
  `hidden items-center rounded-full px-3.5 py-1.5 font-cond text-[20px] uppercase leading-none tracking-[0.04em] text-green transition sm:inline-flex lg:text-[22px] 2xl:text-[24px] ${
    isActive ? '[background:var(--grad-pill-green)] shadow-sm' : 'hover:bg-green/10'
  }`

// Phone menu rows: the same condensed caps, one link per row; the current page sits on a white wash.
const menuLink = ({ isActive }) =>
  `block rounded-xl px-3 py-2.5 font-cond text-[20px] uppercase leading-none tracking-[0.04em] text-green transition ${
    isActive ? 'bg-white/40' : 'hover:bg-white/25'
  }`

export default function Layout({ children }) {
  const { kid, admin } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuBtn = useRef(null)

  // Phone menu: close whenever the route changes…
  useEffect(() => { setMenuOpen(false) }, [pathname])
  // …and on Escape, handing focus back to the toggle.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      menuBtn.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="flex min-h-screen flex-col bg-field">
      <header className="sticky top-0 z-40 bg-sky/95 backdrop-blur">
        {/* Below sm the row must hold brand + login pill + menu toggle on a 360px phone, so the
            phone values are trimmed (44px logo, 8px gaps, 16px pill); every sm: value is the desktop as-is.
            From 2xl the bar is the comp's 100px, and the container is 1612px with a 46px left / 16px right gutter, so on a
            1920 viewport the content spans x 200-1750 — the shield's left edge lands at x=200 and the nav ends at x=1750 as in the comp. */}
        <div className="mx-auto flex min-h-[64px] max-w-[1400px] items-center justify-between gap-2 px-4 sm:min-h-[92px] sm:gap-3 sm:px-6 lg:px-10 2xl:min-h-[100px] 2xl:max-w-[1612px] 2xl:pl-[46px] 2xl:pr-4">
          <Link to="/" className="shrink-0"><Brand size={52} phoneSize={44} wideSize={70} /></Link>
          <nav className="flex items-center gap-1.5 sm:gap-1 lg:gap-2 2xl:gap-3">
            {/* Desktop: four consistent items (no background; the current page shows the green pill). */}
            <NavLink to="/" end className={navItem}>Campaigns</NavLink>
            <NavLink to="/how-to" className={navItem}>How-To</NavLink>
            <NavLink to={kid ? '/me' : '/login'} className={navItem}>
              {/* compact label below lg so a long "My Mivtza Lulov Report" doesn't crowd the bar */}
              <span className="lg:hidden">{kid ? 'My Report' : 'Soldier Login'}</span>
              <span className="hidden lg:inline">{kid ? 'My Mivtza Lulov Report' : 'Soldier Login'}</span>
            </NavLink>
            <NavLink to={admin ? '/admin' : '/admin/login'} className={navItem}>
              {admin ? 'Admin' : 'School Admin'}
            </NavLink>
            {/* Phone (below sm): the desktop items are hidden, so keep a prominent login pill beside the menu. */}
            <Button to={kid ? '/me' : '/login'} variant="green" className="px-3 text-[16px] sm:hidden">
              {kid ? 'My Report' : 'Soldier Login'}
            </Button>
            <button
              ref={menuBtn}
              type="button"
              className="btn btn-ghost -mr-2.5 px-2.5 sm:hidden"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen
                  ? <path d="M6 6l12 12M18 6L6 18" />
                  : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </nav>
        </div>
        {/* Phone-only disclosure menu for the links hidden below sm. */}
        <nav id={menuId} hidden={!menuOpen} aria-label="Site menu" className="border-t border-line bg-sky/95 sm:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-0.5 px-4 py-2">
            <NavLink to="/" end className={menuLink} onClick={() => setMenuOpen(false)}>Campaigns</NavLink>
            <NavLink to="/how-to" className={menuLink} onClick={() => setMenuOpen(false)}>How-To</NavLink>
            <NavLink to={admin ? '/admin' : '/admin/login'} className={menuLink} onClick={() => setMenuOpen(false)}>
              {admin ? 'Admin' : 'School Admin'}
            </NavLink>
            <NavLink to={kid ? '/me' : '/login'} className={menuLink} onClick={() => setMenuOpen(false)}>
              {kid ? 'My Mivtza Lulov Report' : 'Soldier Login'}
            </NavLink>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto bg-green text-white/90">
        {/* Special thanks — label on one side, the sponsor logos on the other, on a
            white panel so each logo's own backdrop blends instead of boxing on green. */}
        <div className="mx-auto max-w-[1400px] px-4 pt-7 sm:px-6 lg:px-10">
          <div className="rounded-2xl bg-white px-6 py-5">
            <div className="flex flex-col items-center gap-4">
              <span className="font-cond text-[17px] uppercase tracking-[0.08em] text-green sm:text-[19px]">Special Thank You to</span>
              <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
                <img src={asset('design/thanks-daled-minim.png')} alt="Itche's Daled Minim" className="h-12 w-auto select-none sm:h-14" draggable="false" />
                <img src={asset('design/thanks-altein.png')} alt="Altein Esrogim — trusted source of Yanover Esrogim since 1929" className="h-12 w-auto select-none sm:h-14" draggable="false" />
              </div>
            </div>
            {/* build credit, inside the panel */}
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 border-t border-navy/10 pt-4 text-center text-[14px] font-medium text-navy/70">
              This site was built by
              <span className="font-cond text-[22px] uppercase leading-none tracking-[0.06em] text-green">Sholem Chaskind</span>
            </p>
          </div>
        </div>

        {/* brand + verse */}
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-7 text-sm sm:flex-row sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <img src={asset('th-logo.png')} alt="" className="h-10 w-auto" />
            <span className="font-cond text-[19px] uppercase leading-none tracking-[0.06em] text-gold">Mivtza Lulav · Tzivos Hashem</span>
          </div>
          <p className="text-center text-white/75 sm:text-right">
            “And you shall take for yourselves on the first day…” — a mitzvah for every Yid.
          </p>
        </div>
      </footer>
    </div>
  )
}
