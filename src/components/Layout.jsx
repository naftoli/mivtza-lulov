import { Link, NavLink } from 'react-router-dom'
import { Brand, Button } from './ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Layout({ children }) {
  const { kid, admin } = useAuth()

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
            {kid
              ? <Button to="/me" variant="gold">My Missions</Button>
              : <Button to="/login" variant="gold">Soldier Login</Button>}
            <Button to={admin ? '/admin' : '/admin/login'} variant="ghost" className="hidden sm:inline-flex">
              {admin ? 'Admin' : 'School Admin'}
            </Button>
          </nav>
        </div>
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
