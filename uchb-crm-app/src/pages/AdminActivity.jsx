import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fmtDateTime } from '../lib/supabase'
import AppHeader from '../components/AppHeader'
import Skeleton from '../components/Skeleton'

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function actorName(entry) {
  return safeStr(entry.actor?.full_name) || safeStr(entry.actor?.email) || 'Someone'
}

function targetUserName(entry) {
  return safeStr(entry.target_user?.full_name) || safeStr(entry.target_user?.email) || 'a user'
}

function leadName(entry) {
  return safeStr(entry.lead?.name) || safeStr(entry.lead?.property_address) || 'a lead'
}

function describeAction(entry, stagesById) {
  const details = entry.details || {}
  switch (entry.action) {
    case 'lead.created':
      return `created lead "${leadName(entry)}"`
    case 'lead.updated':
      return `updated lead "${leadName(entry)}"`
    case 'lead.stage_changed':
      return `moved "${leadName(entry)}" from ${stagesById[details.from] || 'New'} to ${stagesById[details.to] || 'Unknown'}`
    case 'lead.activity_logged':
      return `logged a ${safeStr(details.type) || 'note'} on "${leadName(entry)}"`
    case 'user.invited':
      return `invited ${safeStr(details.email)} as ${safeStr(details.role) || 'pending'}`
    case 'user.invite_resent':
      return `resent invite to ${safeStr(details.email)}`
    case 'user.role_changed':
      return `changed ${targetUserName(entry)}'s role from ${safeStr(details.from)} to ${safeStr(details.to)}`
    case 'user.removed':
      return `removed ${targetUserName(entry)}`
    case 'user.restored':
      return `restored ${targetUserName(entry)}`
    case 'user.name_changed':
      return `renamed ${safeStr(details.from) || targetUserName(entry)} to ${safeStr(details.to)}`
    default:
      return entry.action
  }
}

export default function AdminActivity() {
  const [entries, setEntries] = useState([])
  const [stagesById, setStagesById] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, logRes] = await Promise.all([
        supabase.from('stages').select('id, label'),
        supabase
          .from('audit_log')
          .select(
            `id, action, details, created_at,
             actor:profiles!audit_log_actor_id_fkey(id, full_name, email),
             lead:leads(id, name, property_address),
             target_user:profiles!audit_log_target_user_id_fkey(id, full_name, email)`,
          )
          .order('created_at', { ascending: false })
          .limit(200),
      ])

      if (!active) return

      const map = {}
      for (const s of arr(stagesRes.data)) map[s.id] = s.label
      setStagesById(map)
      setEntries(arr(logRes.data))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Activity log" />

      <main className="space-y-4 px-4 py-6 pb-10">
        <Link to="/admin/users" className="text-sm font-medium text-uchb-teal underline">
          ← Back to users
        </Link>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-uchb-teal/70">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="border-b border-uchb-teal/10 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-uchb-teal">
                    <span className="font-medium">{actorName(entry)}</span> {describeAction(entry, stagesById)}
                  </p>
                  <p className="mt-0.5 text-xs text-uchb-teal/50">{fmtDateTime(entry.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
