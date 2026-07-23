import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import QuickAddButton from './QuickAddButton'
import { useAuth } from '../hooks/useAuth'

const BASE_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/follow-ups', label: 'Follow-ups' },
  { to: '/guides', label: 'Call Guides' },
  { to: '/help', label: 'Help' },
]

const ADMIN_LINKS = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/activity', label: 'Activity log' },
]

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

export default function AppHeader({ title }) {
  const { isAdmin } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = isAdmin ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS

  return (
    <>
      <header className="relative bg-uchb-teal px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-full p-1.5 text-uchb-cream"
          >
            <MenuIcon />
          </button>
          <h1 className="flex-1 truncate text-center text-uchb-cream text-lg font-semibold">{title}</h1>
          <NotificationBell />
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <nav className="flex w-72 max-w-[80vw] flex-col bg-uchb-teal px-4 py-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-uchb-cream text-lg font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-1.5 text-uchb-cream/70"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-xl px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-uchb-cream/10 text-uchb-cream' : 'text-uchb-cream/60'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="flex-1 bg-black/40"
          />
        </div>
      )}

      <QuickAddButton />
    </>
  )
}
