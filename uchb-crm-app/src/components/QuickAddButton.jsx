import { useLocation, useNavigate } from 'react-router-dom'

// Leads already has its own bottom-anchored "+ New Lead" bar, and lead
// detail/admin pages don't need a lead quick-add — only show the floating
// button where it's not redundant or out of place.
const SHOW_ON = ['/dashboard', '/pipeline', '/follow-ups']

export default function QuickAddButton() {
  const location = useLocation()
  const navigate = useNavigate()

  if (!SHOW_ON.includes(location.pathname)) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/leads/new')}
      aria-label="New lead"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-uchb-gold text-uchb-teal shadow-lg"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </button>
  )
}
