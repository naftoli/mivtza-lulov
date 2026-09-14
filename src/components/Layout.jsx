import { Link, NavLink } from 'react-router-dom'
import { Brand, Button } from './ui.jsx'
import { asset } from '../lib/asset.js'
import { useAuth } from '../context/AuthContext.jsx'

// Nav text: condensed caps in green-deep; the active page gets a green-mid underline.
const navText = 'font-cond text-[22px] uppercase leading-none tracking-[0.04em] text-green lg:text-[26px]'
const navLink = ({ isActive }) =>
  `hidden border-b-[3px] pb-0.5 transition sm:block ${navText} ${
    isActive ? 'border-green-mid' : 'border-transparent opacity-85 hover:opacity-100'
  }`

export default function Layout({ children }) {
  const { kid, admin } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-field">
      <header className="sticky top-0 z-40 bg-sky/95 backdrop-blur">
        <div className="mx-auto flex min-h-[64px] max-w-[1400px] items-center justify-between gap-3 px-4 sm:min-h-[92px] sm:px-6 lg:px-10">
          <Link to="/" className="shrink-0"><Brand size={52} /></Link>
          <nav className="flex items-center gap-2 sm:gap-5 lg:gap-9">
            <NavLink to="/" end className={navLink}>
              Campaigns
            </NavLink>
            <NavLink to="/how-to" className={navLink}>
              How-To
            </NavLink>
            {kid
              ? <Button to="/me" variant="green">My Missions</Button>
              : <Button to="/login" variant="green">Soldier Login</Button>}
            <Button to={admin ? '/admin' : '/admin/login'} variant="ghost"
              className={`hidden px-0 opacity-85 hover:opacity-100 sm:inline-flex ${navText}`}>
              {admin ? 'Admin' : 'School Admin'}
            </Button>
          </nav>
        </div>
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
