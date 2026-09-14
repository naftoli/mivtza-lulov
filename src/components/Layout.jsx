import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Brand, Button } from './ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

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

  const menuLink = ({ isActive }) =>
    `block rounded-lg px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-navy/5 text-navy' : 'text-muted hover:text-navy'}`

  return (
    <div className="flex min-h-screen flex-col bg-field">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="shrink-0"><Brand /></Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/" end
              className={({ isActive }) =>
                `hidden rounded-lg px-3 py-2 text-sm font-semibold transition sm:block ${isActive ? 'text-navy' : 'text-muted hover:text-navy'}`}>
              Campaigns
            </NavLink>
            <NavLink to="/how-to"
              className={({ isActive }) =>
                `hidden rounded-lg px-3 py-2 text-sm font-semibold transition sm:block ${isActive ? 'text-navy' : 'text-muted hover:text-navy'}`}>
              How-To
            </NavLink>
            {/* px-3 below sm so the gold button + menu toggle fit beside the brand on 360px phones. */}
            {kid
              ? <Button to="/me" variant="gold" className="px-3 sm:px-4.5">My Missions</Button>
              : <Button to="/login" variant="gold" className="px-3 sm:px-4.5">Soldier Login</Button>}
            <Button to={admin ? '/admin' : '/admin/login'} variant="ghost" className="hidden sm:inline-flex">
              {admin ? 'Admin' : 'School Admin'}
            </Button>
            <button
              ref={menuBtn}
              type="button"
              className="btn btn-ghost -mr-2 px-2.5 sm:hidden"
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
        <nav id={menuId} hidden={!menuOpen} aria-label="Site menu" className="border-t border-line sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-2">
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

      <footer className="mt-auto bg-navy-dark text-white/90">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm sm:flex-row">
          <div className="flex items-center gap-3">
            <img src="/th-logo.svg" alt="" className="h-9 w-auto" />
            <span className="font-semibold uppercase tracking-[0.12em]">Mivtza Lulav · Tzivos Hashem</span>
          </div>
          <p className="text-center text-white/60 sm:text-right">
            “And you shall take for yourselves on the first day…” — a mitzvah for every Yid.
          </p>
        </div>
      </footer>
    </div>
  )
}
