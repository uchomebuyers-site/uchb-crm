import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  if (role === 'member') return 'bg-uchb-gold/20 text-uchb-gold'
  return 'bg-gray-200 text-gray-600'
}

function statusBadgeClasses(status) {
  if (status === 'disabled') return 'bg-gray-200 text-gray-600'
  return 'bg-green-100 text-green-700'
}

// 'admin' = full access, including this Users page. 'member' = full
// access to leads/pipeline/etc, but not admin-only areas (RLS grants
// leads/lead_activity/lead_status_history access to both admin and
// member). 'pending' = signed in but blocked entirely until promoted —
// this is the DB trigger's default for anyone new, so picking it at
// invite time is a no-op.
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Standard' },
  { value: 'pending', label: 'Pending (no access)' },
]

function UserEditForm({ profile, onSaved, onCancel }) {
  const { showToast } = useToast()
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [role, setRole] = useState(profile.role)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: safeStr(fullName).trim() || null, role })
      .eq('id', profile.id)
    setSaving(false)

    if (error) {
      showToast(error.message || 'Could not update user.', 'error')
      return
    }

    showToast('User updated.')
    onSaved({ full_name: safeStr(fullName).trim() || null, role })
  }

  return (
    <div className="mt-3 space-y-2 border-t border-uchb-teal/10 pt-3">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        className="w-full rounded-xl border border-uchb-teal/20 px-3 py-2.5 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full rounded-xl border border-uchb-teal/20 px-3 py-2.5 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-uchb-teal/20 py-2.5 text-sm font-medium text-uchb-teal"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const { session } = useAuth()
  const { showToast } = useToast()

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('admin')
  const [inviting, setInviting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [resendingId, setResendingId] = useState(null)

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

  async function handleResendInvite(profile) {
    setResendingId(profile.id)
    const { data, error } = await supabase.functions.invoke('admin-invite-user', {
      body: { email: profile.email, role: profile.role },
    })
    setResendingId(null)

    if (error || data?.error) {
      showToast(data?.error || error?.message || 'Could not resend invite.', 'error')
      return
    }

    showToast('Invite resent.')
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
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-uchb-teal">All users</p>
            <Link to="/admin/activity" className="text-xs font-medium text-uchb-teal underline">
              Activity log →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <div key={p.id} className="rounded-xl border border-uchb-teal/10 p-3">
                  <div className="flex items-center justify-between gap-3">
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
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId((id) => (id === p.id ? null : p.id))}
                        className="rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-xs font-medium text-uchb-teal"
                      >
                        {editingId === p.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        disabled={p.id === session?.user?.id}
                        onClick={() => toggleStatus(p)}
                        className="rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-xs font-medium text-uchb-teal disabled:opacity-40"
                      >
                        {p.status === 'disabled' ? 'Restore' : 'Remove'}
                      </button>
                      <button
                        type="button"
                        disabled={resendingId === p.id}
                        onClick={() => handleResendInvite(p)}
                        className="rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-xs font-medium text-uchb-teal disabled:opacity-40"
                      >
                        {resendingId === p.id ? 'Sending…' : 'Resend invite'}
                      </button>
                    </div>
                  </div>

                  {editingId === p.id && (
                    <UserEditForm
                      profile={p}
                      onCancel={() => setEditingId(null)}
                      onSaved={(fields) => {
                        setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...fields } : x)))
                        setEditingId(null)
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
