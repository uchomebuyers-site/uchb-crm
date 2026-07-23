import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, fmtDate } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import AppHeader from '../components/AppHeader'
import OwnerChip from '../components/OwnerChip'
import Skeleton from '../components/Skeleton'

function arr(v) {
  return Array.isArray(v) ? v : []
}

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

const STAGE_BAR_COLORS = {
  teal: 'bg-uchb-teal',
  gold: 'bg-uchb-gold',
  green: 'bg-green-600',
  gray: 'bg-gray-400',
}

// New foreclosure leads first — speed-to-lead matters most on a fresh
// opportunity, and foreclosure has a real deadline (the sale date) behind
// it. Under Contract going quiet next — money is on the table. Follow-ups
// due/overdue next (a promised touch). Foreclosure leads going quiet rank
// above general Hot leads since their clock is ticking. Hot leads cooling
// off last (still valuable, but nothing's overdue yet).
const PRIORITY = {
  new_foreclosure: 1,
  under_contract_quiet: 2,
  follow_up_due: 3,
  foreclosure_quiet: 4,
  hot_quiet: 5,
}

const FORECLOSURE_SOURCE_LABEL = 'Foreclosure Monitor'

function todayISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysSince(dateLike) {
  if (!dateLike) return Infinity
  const then = new Date(dateLike).getTime()
  if (Number.isNaN(then)) return Infinity
  return Math.floor((Date.now() - then) / 86400000)
}

function buildAttentionItems(leads, stages, lastActivityByLead, sourcesById) {
  const terminalIds = new Set(stages.filter((s) => s.is_terminal).map((s) => s.id))
  const underContractId = stages.find((s) => s.label === 'Under Contract')?.id
  // The earliest non-terminal stage, whatever it's labeled (read from
  // sort_order, never hard-coded) — a foreclosure lead still sitting here
  // hasn't been touched yet.
  const earliestActiveStageId = [...stages]
    .filter((s) => !s.is_terminal)
    .sort((a, b) => a.sort_order - b.sort_order)[0]?.id
  const today = todayISODate()

  const items = []

  for (const lead of leads) {
    if (terminalIds.has(lead.stage)) continue

    const isForeclosure = sourcesById[lead.source]?.label === FORECLOSURE_SOURCE_LABEL
    const lastContact = lastActivityByLead[lead.id] || lead.created_at
    const quietDays = daysSince(lastContact)

    if (isForeclosure && earliestActiveStageId && lead.stage === earliestActiveStageId) {
      items.push({
        lead,
        priority: PRIORITY.new_foreclosure,
        sortKey: lead.created_at,
        tag: 'Foreclosure',
        reason: 'New foreclosure lead — reach out today',
      })
      continue
    }

    if (underContractId && lead.stage === underContractId && quietDays >= 2) {
      items.push({
        lead,
        priority: PRIORITY.under_contract_quiet,
        sortKey: -quietDays,
        reason: `Under contract, no activity in ${quietDays}d — check in`,
      })
      continue
    }

    if (lead.next_follow_up && lead.next_follow_up <= today) {
      items.push({
        lead,
        priority: PRIORITY.follow_up_due,
        sortKey: lead.next_follow_up,
        reason:
          lead.next_follow_up === today
            ? 'Follow-up due today'
            : `Follow-up overdue since ${fmtDate(lead.next_follow_up)}`,
      })
      continue
    }

    if (isForeclosure && quietDays >= 1) {
      items.push({
        lead,
        priority: PRIORITY.foreclosure_quiet,
        sortKey: -quietDays,
        tag: 'Foreclosure',
        reason: `Foreclosure lead, no activity in ${quietDays}d — time-sensitive`,
      })
      continue
    }

    if (lead.temperature === 'Hot' && quietDays >= 3) {
      items.push({
        lead,
        priority: PRIORITY.hot_quiet,
        sortKey: -quietDays,
        reason: `Hot lead, no activity in ${quietDays}d`,
      })
    }
  }

  items.sort((a, b) => a.priority - b.priority || String(a.sortKey).localeCompare(String(b.sortKey)))
  return items
}

function AttentionCard({ item, ownerName }) {
  const navigate = useNavigate()
  const { lead, reason, tag } = item

  return (
    <button
      type="button"
      onClick={() => navigate(`/leads/${lead.id}`)}
      className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm active:bg-uchb-cream"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold text-uchb-teal">{safeStr(lead.name) || 'Unnamed lead'}</p>
          {tag && (
            <span className="shrink-0 rounded-full bg-uchb-teal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-uchb-cream">
              {tag}
            </span>
          )}
        </div>
        <OwnerChip name={ownerName} />
      </div>
      <p className="mt-0.5 text-sm text-uchb-teal/70">{safeStr(lead.property_address) || 'No address'}</p>
      <p className="mt-2 text-xs font-medium text-uchb-gold">{reason}</p>
    </button>
  )
}

function SetPasswordForm() {
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error')
      return
    }
    if (password !== confirm) {
      showToast('Passwords do not match.', 'error')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      showToast(error.message || 'Could not set password.', 'error')
      return
    }

    showToast('Password set.')
    setPassword('')
    setConfirm('')
    setExpanded(false)
  }

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-sm font-medium text-uchb-teal"
      >
        {expanded ? 'Cancel' : 'Set a password'}
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-uchb-teal/20 px-3 py-2.5 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-uchb-teal/20 px-3 py-2.5 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </div>
  )
}

function EmailNotificationsToggle() {
  const { profile, session } = useAuth()
  const { showToast } = useToast()
  const [enabled, setEnabled] = useState(profile?.email_notifications_enabled !== false)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    const previous = enabled
    setEnabled(next)
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ email_notifications_enabled: next })
      .eq('id', session?.user?.id)

    setSaving(false)

    if (error) {
      setEnabled(previous)
      showToast('Could not update setting.', 'error')
      return
    }

    showToast(next ? 'Email notifications enabled.' : 'Email notifications muted.')
  }

  return (
    <label className="flex w-full max-w-xs items-center justify-between gap-3 rounded-2xl bg-white p-4 text-sm text-uchb-teal shadow-sm">
      <span>Email notifications</span>
      <input type="checkbox" checked={enabled} disabled={saving} onChange={toggle} />
    </label>
  )
}

export default function Dashboard() {
  const { profile, session } = useAuth()
  const displayName = profile?.full_name || profile?.email || session?.user?.email

  const [stages, setStages] = useState([])
  const [leads, setLeads] = useState([])
  const [admins, setAdmins] = useState([])
  const [sources, setSources] = useState([])
  const [lastActivityByLead, setLastActivityByLead] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, leadsRes, adminsRes, activityRes, sourcesRes] = await Promise.all([
        supabase.from('stages').select('id, label, sort_order, is_terminal, color').order('sort_order'),
        supabase
          .from('leads')
          .select('id, name, property_address, temperature, stage, assigned_to, source, next_follow_up, created_at')
          .is('archived_at', null),
        supabase.from('profiles').select('id, full_name, email').in('role', ['admin', 'member']),
        supabase.from('lead_activity').select('lead_id, created_at').order('created_at', { ascending: false }),
        supabase.from('sources').select('id, label'),
      ])

      if (!active) return

      setStages(arr(stagesRes.data))
      setLeads(arr(leadsRes.data))
      setAdmins(arr(adminsRes.data))
      setSources(arr(sourcesRes.data))

      const lastByLead = {}
      for (const a of arr(activityRes.data)) {
        if (!lastByLead[a.lead_id]) lastByLead[a.lead_id] = a.created_at
      }
      setLastActivityByLead(lastByLead)

      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const adminsById = {}
  for (const a of admins) adminsById[a.id] = a.full_name || a.email

  const sourcesById = {}
  for (const s of sources) sourcesById[s.id] = s

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const newThisWeek = leads.filter((l) => l.created_at && new Date(l.created_at) >= sevenDaysAgo).length

  const countByStage = stages.map((s) => ({
    ...s,
    count: leads.filter((l) => l.stage === s.id).length,
  }))
  const maxCount = Math.max(1, ...countByStage.map((s) => s.count))

  const attentionItems = buildAttentionItems(leads, stages, lastActivityByLead, sourcesById)

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="UCHB CRM" />

      <main className="space-y-6 px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-3 text-lg font-medium text-uchb-teal">
                {attentionItems.length === 0
                  ? "You're all caught up — nothing urgent right now."
                  : attentionItems.length === 1
                    ? '1 lead needs your attention'
                    : `${attentionItems.length} leads need your attention`}
              </p>
              {attentionItems.length > 0 && (
                <div className="space-y-3">
                  {attentionItems.map((item) => (
                    <AttentionCard key={item.lead.id} item={item} ownerName={adminsById[item.lead.assigned_to]} />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white/60 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-xs text-uchb-teal/50">
                <span>Leads by stage</span>
                <span className="font-semibold text-uchb-teal/70">
                  {newThisWeek} new this week
                </span>
              </div>
              <div className="space-y-1.5">
                {countByStage.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-[11px] text-uchb-teal/50">{s.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-uchb-teal/5">
                      <div
                        className={`h-full rounded-full ${STAGE_BAR_COLORS[s.color] || STAGE_BAR_COLORS.gray}`}
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right text-[11px] text-uchb-teal/50">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <p className="text-uchb-teal/70 text-sm">Signed in as {displayName}</p>

          <EmailNotificationsToggle />

          <SetPasswordForm />

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded-xl bg-uchb-gold px-6 py-3 font-medium text-uchb-teal shadow-sm"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
