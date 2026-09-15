import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Brand, Button } from './ui.jsx'
import { asset } from '../lib/asset.js'
import { useAuth } from '../context/AuthContext.jsx'

// Nav text: condensed caps in green-deep; the active page gets a green-mid underline.
// 30px from 2xl is the comp's size; lg/xl sit at ~85% of it.
const navText = 'font-cond text-[22px] uppercase leading-none tracking-[0.04em] text-green lg:text-[24px] 2xl:text-[26px]'
const navLink = ({ isActive }) =>
  `hidden border-b-[3px] pb-0.5 transition sm:block ${navText} ${
    isActive ? 'border-green-mid' : 'border-transparent opacity-85 hover:opacity-100'
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
          <nav className="flex items-center gap-1.5 sm:gap-5 lg:gap-9 2xl:gap-10">
            <NavLink to="/" end className={navLink}>
              Campaigns
            </NavLink>
            <NavLink to="/how-to" className={navLink}>
              How-To
            </NavLink>
            {/* px-3 + 16px caps below sm so the green pill + menu toggle fit beside the brand on 360px
                phones; sm:px-6 / sm:text-[18px] restore .btn's defaults, so the desktop pill is unchanged.
                From 2xl the pill is the comp's ~145x46: 24px caps (11px + 24 + 11) with 14px sides. */}
            {kid
              ? <Button to="/me" variant="green" className="px-3 text-[16px] sm:px-6 sm:text-[18px] 2xl:px-[14px] 2xl:py-[11px] 2xl:text-[24px]">My Missions</Button>
              : <Button to="/login" variant="green" className="px-3 text-[16px] sm:px-6 sm:text-[18px] 2xl:px-[14px] 2xl:py-[11px] 2xl:text-[24px]">Soldier Login</Button>}
            <Button to={admin ? '/admin' : '/admin/login'} variant="ghost"
              className={`hidden px-0 opacity-85 hover:opacity-100 sm:inline-flex ${navText}`}>
              {admin ? 'Admin' : 'School Admin'}
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
              {kid ? 'My Missions' : 'Soldier Login'}
            </NavLink>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto bg-green text-white/90">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-7 text-sm sm:flex-row sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <img src={asset('th-logo.svg')} alt="" className="h-10 w-auto" />
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
