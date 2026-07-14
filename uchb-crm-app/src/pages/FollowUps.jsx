import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fmtDate, fmtPhone } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import AppHeader from '../components/AppHeader'
import Skeleton from '../components/Skeleton'
import OwnerChip from '../components/OwnerChip'
import OwnerFilter from '../components/OwnerFilter'

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function tempClasses(temp) {
  if (temp === 'Hot') return 'bg-uchb-gold text-uchb-teal'
  if (temp === 'Warm') return 'bg-uchb-teal text-uchb-cream'
  if (temp === 'Cold') return 'bg-gray-200 text-gray-500'
  return 'bg-gray-100 text-gray-400'
}

function todayISODate() {
  // Use local date parts, not toISOString() (which is UTC and can land on
  // the wrong calendar day for evening users west of UTC).
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const ACTIVITY_TYPES = ['call', 'text', 'note', 'offer']

function FollowUpCard({ lead, ownerName }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [activityType, setActivityType] = useState('call')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const today = todayISODate()
  const isOverdue = lead.next_follow_up < today

  async function handleLog(e) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    setSaving(true)
    const { error } = await supabase.from('lead_activity').insert({
      lead_id: lead.id,
      author_id: session?.user?.id,
      type: activityType,
      body: trimmed,
    })
    setSaving(false)

    if (error) {
      showToast('Could not log activity.', 'error')
      return
    }

    showToast('Activity logged.')
    setBody('')
    setExpanded(false)
  }

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ${isOverdue ? 'border-l-4 border-uchb-teal/40' : ''}`}>
      <button type="button" onClick={() => navigate(`/leads/${lead.id}`)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-uchb-teal">{safeStr(lead.name) || 'Unnamed lead'}</p>
          <OwnerChip name={ownerName} />
        </div>
        <p className="mt-0.5 text-sm text-uchb-teal/70">{safeStr(lead.property_address) || 'No address'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {lead.temperature && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tempClasses(lead.temperature)}`}>
              {lead.temperature}
            </span>
          )}
          <span className="text-xs font-medium text-uchb-teal/50">
            {isOverdue ? `Overdue since ${fmtDate(lead.next_follow_up)}` : `Due ${fmtDate(lead.next_follow_up)}`}
          </span>
        </div>
      </button>

      <div className="mt-3 flex items-center gap-3">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="text-sm text-uchb-teal underline">
            {fmtPhone(lead.phone)}
          </a>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-sm font-medium text-uchb-teal"
        >
          {expanded ? 'Cancel' : 'Log'}
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleLog} className="mt-3 space-y-2 border-t border-uchb-teal/10 pt-3">
          <div className="flex gap-2">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActivityType(t)}
                className={`flex-1 rounded-xl py-2 text-xs font-medium capitalize ${
                  activityType === t ? 'bg-uchb-teal text-uchb-cream' : 'border border-uchb-teal/20 text-uchb-teal/60'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="What happened?"
            className="w-full rounded-xl border border-uchb-teal/20 px-3 py-2 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
          />
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="w-full rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream disabled:opacity-60"
          >
            Log activity
          </button>
        </form>
      )}
    </div>
  )
}

export default function FollowUps() {
  const [leads, setLeads] = useState([])
  const [admins, setAdmins] = useState([])
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const today = todayISODate()
      const [stagesRes, leadsRes, adminsRes] = await Promise.all([
        supabase.from('stages').select('id, is_terminal'),
        supabase
          .from('leads')
          .select('id, name, phone, property_address, temperature, next_follow_up, stage, assigned_to')
          .lte('next_follow_up', today)
          .order('next_follow_up', { ascending: true }),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'admin'),
      ])

      if (!active) return

      const terminalIds = new Set(arr(stagesRes.data).filter((s) => s.is_terminal).map((s) => s.id))
      const filtered = arr(leadsRes.data).filter((l) => l.next_follow_up && !terminalIds.has(l.stage))
      setLeads(filtered)
      setAdmins(arr(adminsRes.data))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const adminsById = {}
  for (const a of admins) adminsById[a.id] = a.full_name || a.email

  const visibleLeads = ownerFilter === 'all' ? leads : leads.filter((l) => l.assigned_to === ownerFilter)

  const count = visibleLeads.length
  const headline =
    leads.length === 0
      ? "You're all caught up — no follow-ups due today."
      : count === 0
        ? 'No follow-ups for this filter today.'
        : count === 1
          ? '1 lead needs you today'
          : `${count} leads need you today`

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Follow-ups" />

      <main className="px-4 py-4 pb-10">
        {!loading && admins.length > 0 && (
          <div className="mb-3">
            <OwnerFilter admins={admins} value={ownerFilter} onChange={setOwnerFilter} />
          </div>
        )}

        <p className="mb-4 text-lg font-medium text-uchb-teal">{headline}</p>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
                <Skeleton className="mb-2 h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-uchb-teal/70">Nice work — check back tomorrow.</p>
          </div>
        ) : visibleLeads.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-uchb-teal/70">No follow-ups assigned here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleLeads.map((lead) => (
              <FollowUpCard key={lead.id} lead={lead} ownerName={adminsById[lead.assigned_to]} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
