import { NavLink } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import { useAuth } from '../hooks/useAuth'

const BASE_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/follow-ups', label: 'Follow-ups' },
]

export default function AppHeader({ title }) {
  const { isAdmin } = useAuth()
  const links = isAdmin ? [...BASE_LINKS, { to: '/admin/users', label: 'Users' }] : BASE_LINKS

  return (
    <header className="relative bg-uchb-teal px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-uchb-cream text-lg font-semibold">{title}</h1>
        <NotificationBell />
      </div>
      <nav className="mt-3 flex gap-4 overflow-x-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `whitespace-nowrap pb-3 text-sm font-medium ${
                isActive ? 'border-b-2 border-uchb-gold text-uchb-cream' : 'text-uchb-cream/60'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
