import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import AppHeader from '../components/AppHeader'
import Skeleton from '../components/Skeleton'

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function roleBadgeClasses(role) {
  if (role === 'admin') return 'bg-uchb-teal text-uchb-cream'
  return 'bg-uchb-gold/20 text-uchb-gold'
}

function statusBadgeClasses(status) {
  if (status === 'disabled') return 'bg-gray-200 text-gray-600'
  return 'bg-green-100 text-green-700'
}

// Only 'admin' has any RLS-driven meaning today — is_admin() checks
// exactly this. The selector still offers 'pending' for future-proofing
// (e.g. once other roles exist), but picking it at invite time is a
// no-op since that's already the trigger's default for new sign-ins.
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'pending', label: 'Pending (no elevated access)' },
]

export default function AdminUsers() {
  const { session } = useAuth()
  const { showToast } = useToast()

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('admin')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .order('email')
    setProfiles(arr(data))
    setLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return

    setInviting(true)
    const { data, error } = await supabase.functions.invoke('admin-invite-user', {
      body: { email, role: inviteRole },
    })
    setInviting(false)

    if (error || data?.error) {
      showToast(data?.error || error?.message || 'Could not send invite.', 'error')
      return
    }

    showToast('Invite sent.')
    setInviteEmail('')
    load()
  }

  async function toggleStatus(profile) {
    const nextStatus = profile.status === 'disabled' ? 'active' : 'disabled'
    const previousStatus = profile.status

    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, status: nextStatus } : p)))

    const { error } = await supabase.from('profiles').update({ status: nextStatus }).eq('id', profile.id)

    if (error) {
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, status: previousStatus } : p)))
      showToast('Could not update user.', 'error')
      return
    }

    showToast(nextStatus === 'disabled' ? 'User removed.' : 'User restored.')
  }

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Users" />

      <main className="space-y-4 px-4 py-6 pb-10">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-uchb-teal">Invite user</p>
          <form onSubmit={handleInvite} className="space-y-2">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="w-full rounded-xl bg-uchb-teal py-3 font-medium text-uchb-cream disabled:opacity-60"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-uchb-teal">All users</p>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-uchb-teal/10 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-uchb-teal">
                      {safeStr(p.full_name) || safeStr(p.email) || 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-uchb-teal/60">{p.email}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${roleBadgeClasses(p.role)}`}
                      >
                        {p.role}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClasses(p.status)}`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={p.id === session?.user?.id}
                    onClick={() => toggleStatus(p)}
                    className="shrink-0 rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-xs font-medium text-uchb-teal disabled:opacity-40"
                  >
                    {p.status === 'disabled' ? 'Restore' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
