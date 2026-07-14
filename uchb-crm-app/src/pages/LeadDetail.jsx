import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, fmtPhone } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Skeleton from '../components/Skeleton'

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function fmtDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function tempClasses(temp, active) {
  if (!active) return 'bg-white text-uchb-teal/60 border border-uchb-teal/20'
  if (temp === 'Hot') return 'bg-uchb-gold text-uchb-teal border border-uchb-gold'
  if (temp === 'Warm') return 'bg-uchb-teal text-uchb-cream border border-uchb-teal'
  return 'bg-gray-300 text-gray-700 border border-gray-300'
}

const ACTIVITY_TYPES = ['call', 'text', 'note', 'offer']

function notifyIfHotOrUnderContract(previousLead, fields, stagesList) {
  const underContractId = stagesList.find((s) => s.label === 'Under Contract')?.id

  if (fields.temperature === 'Hot' && previousLead.temperature !== 'Hot') {
    supabase.functions.invoke('stage-notify', { body: { leadId: previousLead.id, type: 'hot' } }).catch(() => {})
  }

  if (underContractId && fields.stage === underContractId && previousLead.stage !== underContractId) {
    supabase.functions
      .invoke('stage-notify', { body: { leadId: previousLead.id, type: 'under_contract' } })
      .catch(() => {})
  }
}

export default function LeadDetail() {
  const { id } = useParams()
  const { session } = useAuth()
  const { showToast } = useToast()

  const [lead, setLead] = useState(null)
  const [stages, setStages] = useState([])
  const [sourcesById, setSourcesById] = useState({})
  const [activities, setActivities] = useState([])
  const [authorsById, setAuthorsById] = useState({})
  const [loading, setLoading] = useState(true)

  const [activityType, setActivityType] = useState('call')
  const [activityBody, setActivityBody] = useState('')
  const [loggingActivity, setLoggingActivity] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [leadRes, stagesRes, sourcesRes, activitiesRes, profilesRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).single(),
        supabase.from('stages').select('id, label, sort_order, is_terminal, color').order('sort_order'),
        supabase.from('sources').select('id, label'),
        supabase.from('lead_activity').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email'),
      ])

      if (!active) return

      setLead(leadRes.data || null)
      setStages(arr(stagesRes.data))

      const srcMap = {}
      for (const s of arr(sourcesRes.data)) srcMap[s.id] = s.label
      setSourcesById(srcMap)

      const authMap = {}
      for (const p of arr(profilesRes.data)) authMap[p.id] = p.full_name || p.email
      setAuthorsById(authMap)

      setActivities(arr(activitiesRes.data))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [id])

  async function patchLead(fields, successMessage) {
    const previous = lead
    setLead((prev) => ({ ...prev, ...fields }))

    const { error } = await supabase.from('leads').update(fields).eq('id', id)

    if (error) {
      setLead(previous)
      showToast('Update failed, reverted.', 'error')
      return
    }

    // Fire-and-forget: don't block the success toast on this resolving.
    notifyIfHotOrUnderContract(previous, fields, stages)

    if (successMessage) showToast(successMessage)
  }

  async function handleActivitySubmit(e) {
    e.preventDefault()
    const body = safeStr(activityBody).trim()
    if (!body) return

    setLoggingActivity(true)
    const tempId = `temp-${Date.now()}`
    const optimisticRow = {
      id: tempId,
      lead_id: id,
      author_id: session?.user?.id,
      type: activityType,
      body,
      created_at: new Date().toISOString(),
      _pending: true,
    }
    setActivities((prev) => [optimisticRow, ...prev])
    setActivityBody('')

    const { data: inserted, error } = await supabase
      .from('lead_activity')
      .insert({
        lead_id: id,
        author_id: session?.user?.id,
        type: activityType,
        body,
      })
      .select()
      .single()

    setLoggingActivity(false)

    if (error || !inserted) {
      setActivities((prev) => prev.filter((a) => a.id !== tempId))
      showToast('Could not log activity.', 'error')
      return
    }

    setActivities((prev) => prev.map((a) => (a.id === tempId ? inserted : a)))
    showToast('Activity logged.')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-uchb-cream">
        <header className="bg-uchb-teal px-6 py-4">
          <Link to="/leads" className="text-uchb-cream/70 text-sm">
            &larr; Leads
          </Link>
        </header>
        <main className="space-y-4 px-4 py-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-uchb-cream">
        <header className="bg-uchb-teal px-6 py-4">
          <Link to="/leads" className="text-uchb-cream/70 text-sm">
            &larr; Leads
          </Link>
        </header>
        <main className="px-4 py-16 text-center">
          <p className="text-uchb-teal">Lead not found.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-uchb-cream">
      <header className="bg-uchb-teal px-6 py-4">
        <Link to="/leads" className="text-uchb-cream/70 text-sm">
          &larr; Leads
        </Link>
        <h1 className="text-uchb-cream text-lg font-semibold">{safeStr(lead.name) || 'Unnamed lead'}</h1>
      </header>

      <main className="space-y-4 px-4 py-6 pb-10">
        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="block text-uchb-teal underline">
              {fmtPhone(lead.phone)}
            </a>
          )}
          {lead.property_address && (
            <a
              href={`https://maps.apple.com/?q=${encodeURIComponent(lead.property_address)}`}
              target="_blank"
              rel="noreferrer"
              className="block text-uchb-teal underline"
            >
              {lead.property_address}
            </a>
          )}
          {lead.email && <p className="text-uchb-teal/70 text-sm">{lead.email}</p>}
          {lead.source && (
            <p className="text-uchb-teal/70 text-sm">Source: {sourcesById[lead.source] || '—'}</p>
          )}
          {lead.timeline_to_sell && (
            <p className="text-uchb-teal/70 text-sm">Timeline: {lead.timeline_to_sell}</p>
          )}
          {lead.motivation && <p className="text-uchb-teal/70 text-sm">Motivation: {lead.motivation}</p>}
          {lead.notes && <p className="text-uchb-teal/70 text-sm">Notes: {lead.notes}</p>}
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Stage</label>
            <select
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              value={lead.stage || ''}
              onChange={(e) => patchLead({ stage: e.target.value }, 'Stage updated.')}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Temperature</label>
            <div className="flex gap-2">
              {['Hot', 'Warm', 'Cold'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patchLead({ temperature: t }, 'Temperature updated.')}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${tempClasses(t, lead.temperature === t)}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Next follow-up</label>
            <input
              type="date"
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              value={lead.next_follow_up || ''}
              onChange={(e) => patchLead({ next_follow_up: e.target.value || null }, 'Follow-up date updated.')}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-uchb-teal">Log activity</p>
          <form onSubmit={handleActivitySubmit} className="space-y-2">
            <div className="flex gap-2">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityType(t)}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium capitalize ${
                    activityType === t
                      ? 'bg-uchb-teal text-uchb-cream'
                      : 'border border-uchb-teal/20 text-uchb-teal/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              rows={2}
              value={activityBody}
              onChange={(e) => setActivityBody(e.target.value)}
              placeholder="What happened?"
            />
            <button
              type="submit"
              disabled={loggingActivity || !activityBody.trim()}
              className="w-full rounded-xl bg-uchb-teal py-3 font-medium text-uchb-cream disabled:opacity-60"
            >
              Log activity
            </button>
          </form>

          <div className="space-y-3 pt-2">
            {activities.length === 0 && (
              <p className="text-uchb-teal/60 text-sm">No activity logged yet.</p>
            )}
            {activities.map((a) => (
              <div key={a.id} className={`border-l-2 border-uchb-teal/20 pl-3 ${a._pending ? 'opacity-50' : ''}`}>
                <p className="text-xs font-medium text-uchb-teal/60">
                  <span className="capitalize">{a.type}</span> &middot; {authorsById[a.author_id] || 'Unknown'} &middot;{' '}
                  {fmtDateTime(a.created_at)}
                </p>
                <p className="text-uchb-teal text-sm">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
