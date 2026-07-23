import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ENRICHMENT_ACTIONS, runEnrichment, type EnrichmentAction } from '../_shared/enrichment.ts'

// Remote MCP server for direct CRM access from a Claude Project chat —
// same idea as foreclosure-lead-manage (Hermes), but for a human account
// owner instead of an external agent, so scope is "nearly everything the
// app UI can do" rather than source-restricted. Auth is a per-person
// bearer token (see api_tokens table) embedded in the connector URL path,
// not a Supabase Auth session, so every write manually attributes to the
// right person and manually writes audit_log (the DB triggers that do
// this automatically only fire when auth.uid() is set, which it never is
// here — same reason foreclosure-lead-manage does it manually too).

const PROTOCOL_VERSION = '2025-06-18'
const FORECLOSURE_SOURCE_LABEL = 'Foreclosure Monitor'

type Actor = { id: string; full_name: string | null; email: string }

function todayISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysSince(dateLike: string | null | undefined): number {
  if (!dateLike) return Infinity
  const then = new Date(dateLike).getTime()
  if (Number.isNaN(then)) return Infinity
  return Math.floor((Date.now() - then) / 86400000)
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// deno-lint-ignore no-explicit-any
type DB = SupabaseClient<any, any, any>

async function logAudit(supabase: DB, actor: Actor, action: string, leadId: string | null, details: unknown) {
  await supabase.from('audit_log').insert({ actor_id: actor.id, action, lead_id: leadId, details })
}

// ---------- Tool implementations ----------

async function toolSearchLeads(supabase: DB, args: Record<string, unknown>) {
  const term = String(args.query ?? '').trim()
  if (!term) return { error: 'query is required' }

  const SELECT =
    'id, name, phone, email, property_address, stage, temperature, source, assigned_to, next_follow_up, archived_at, created_at'
  const digits = term.replace(/\D/g, '')
  const lookups = [
    supabase.from('leads').select(SELECT).ilike('name', `%${term}%`).limit(10),
    supabase.from('leads').select(SELECT).ilike('property_address', `%${term}%`).limit(10),
    supabase.from('leads').select(SELECT).ilike('email', `%${term}%`).limit(10),
  ]
  if (digits.length >= 3) lookups.push(supabase.from('leads').select(SELECT).ilike('phone', `%${digits}%`).limit(10))

  const results = await Promise.all(lookups)
  // deno-lint-ignore no-explicit-any
  const byId = new Map<string, any>()
  for (const r of results) {
    for (const row of r.data ?? []) byId.set(row.id, row)
  }
  const rows = [...byId.values()].slice(0, 20)
  if (rows.length === 0) return { count: 0, leads: [] }

  const [{ data: stages }, { data: sources }, { data: profiles }, { data: leadTags }, { data: tags }] = await Promise.all([
    supabase.from('stages').select('id, label'),
    supabase.from('sources').select('id, label, direction'),
    supabase.from('profiles').select('id, full_name, email'),
    supabase
      .from('lead_tags')
      .select('lead_id, tag_id')
      .in(
        'lead_id',
        rows.map((r) => r.id),
      ),
    supabase.from('tags').select('id, label'),
  ])
  const stageById = new Map((stages ?? []).map((s: { id: string; label: string }) => [s.id, s.label]))
  const sourceById = new Map((sources ?? []).map((s: { id: string; label: string; direction: string }) => [s.id, s]))
  const nameById = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; email: string }) => [p.id, p.full_name || p.email]),
  )
  const tagLabelById = new Map((tags ?? []).map((t: { id: string; label: string }) => [t.id, t.label]))
  const tagsByLead = new Map<string, string[]>()
  for (const row of leadTags ?? []) {
    const label = tagLabelById.get(row.tag_id)
    if (!label) continue
    if (!tagsByLead.has(row.lead_id)) tagsByLead.set(row.lead_id, [])
    tagsByLead.get(row.lead_id)!.push(label)
  }

  return {
    count: rows.length,
    // deno-lint-ignore no-explicit-any
    leads: rows.map((l: any) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      propertyAddress: l.property_address,
      stage: stageById.get(l.stage) ?? null,
      temperature: l.temperature,
      source: sourceById.get(l.source)?.label ?? null,
      direction: sourceById.get(l.source)?.direction ?? null,
      tags: tagsByLead.get(l.id) ?? [],
      assignedTo: nameById.get(l.assigned_to) ?? null,
      nextFollowUp: l.next_follow_up,
      archived: Boolean(l.archived_at),
    })),
  }
}

async function toolGetLead(supabase: DB, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  if (!leadId) return { error: 'leadId is required' }

  const [leadRes, stagesRes, sourcesRes, profilesRes, leadTagsRes, tagsRes, activityRes, enrichmentsRes] = await Promise.all([
    supabase.from('leads').select('*').eq('id', leadId).single(),
    supabase.from('stages').select('id, label'),
    supabase.from('sources').select('id, label, direction'),
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('lead_tags').select('tag_id').eq('lead_id', leadId),
    supabase.from('tags').select('id, label'),
    supabase
      .from('lead_activity')
      .select('type, body, created_at, author_id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('lead_enrichments')
      .select('type, status, summary, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false }),
  ])

  if (leadRes.error || !leadRes.data) return { error: 'Lead not found' }
  const lead = leadRes.data

  const stageById = new Map((stagesRes.data ?? []).map((s: { id: string; label: string }) => [s.id, s.label]))
  const sourceById = new Map(
    (sourcesRes.data ?? []).map((s: { id: string; label: string; direction: string }) => [s.id, s]),
  )
  const nameById = new Map(
    (profilesRes.data ?? []).map((p: { id: string; full_name: string | null; email: string }) => [
      p.id,
      p.full_name || p.email,
    ]),
  )
  const tagLabelById = new Map((tagsRes.data ?? []).map((t: { id: string; label: string }) => [t.id, t.label]))

  const latestByType: Record<string, unknown> = {}
  for (const row of enrichmentsRes.data ?? []) {
    if (!latestByType[row.type]) latestByType[row.type] = row
  }

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    propertyAddress: lead.property_address,
    county: lead.county,
    stage: stageById.get(lead.stage) ?? null,
    temperature: lead.temperature,
    source: sourceById.get(lead.source)?.label ?? null,
    direction: sourceById.get(lead.source)?.direction ?? null,
    assignedTo: nameById.get(lead.assigned_to) ?? null,
    nextFollowUp: lead.next_follow_up,
    timelineToSell: lead.timeline_to_sell,
    motivation: lead.motivation,
    notes: lead.notes,
    isOnMarket: lead.is_on_market,
    listingUrl: lead.listing_url,
    ownerName: lead.owner_name,
    ownerPhone: lead.owner_phone,
    listingAgentName: lead.listing_agent_name,
    listingAgentPhone: lead.listing_agent_phone,
    listingAgentBrokerage: lead.listing_agent_brokerage,
    arv: lead.arv,
    askingPrice: lead.asking_price,
    repairEstimate: lead.repair_estimate,
    targetOffer: lead.target_offer,
    underwritingUrl: lead.underwriting_url,
    driveFolderUrl: lead.drive_folder_url,
    archived: Boolean(lead.archived_at),
    tags: (leadTagsRes.data ?? []).map((r: { tag_id: string }) => tagLabelById.get(r.tag_id)).filter(Boolean),
    recentActivity: (activityRes.data ?? []).map((a: Record<string, unknown>) => ({
      type: a.type,
      body: a.body,
      at: a.created_at,
      by: a.author_id ? nameById.get(a.author_id as string) ?? 'Unknown' : 'Automated',
    })),
    enrichments: latestByType,
  }
}

async function toolCreateLead(supabase: DB, actor: Actor, args: Record<string, unknown>) {
  const name = String(args.name ?? '').trim()
  const phone = String(args.phone ?? '').replace(/\D/g, '')
  const propertyAddress = String(args.propertyAddress ?? '').trim()
  if (!name || !phone || !propertyAddress) {
    return { error: 'name, phone, and propertyAddress are required' }
  }

  const [byPhone, byAddress] = await Promise.all([
    supabase.from('leads').select('id, name, property_address').eq('phone', phone),
    supabase.from('leads').select('id, name, property_address').ilike('property_address', propertyAddress),
  ])
  // deno-lint-ignore no-explicit-any
  const dupes = new Map<string, any>()
  for (const l of [...(byPhone.data ?? []), ...(byAddress.data ?? [])]) dupes.set(l.id, l)

  if (dupes.size > 0 && !args.confirmDuplicate) {
    return {
      warning: 'Possible duplicate lead(s) found by phone or address. Call again with confirmDuplicate:true to create anyway.',
      duplicates: [...dupes.values()],
    }
  }

  let sourceId: string | null = null
  if (args.sourceLabel) {
    const { data: sources } = await supabase.from('sources').select('id, label')
    const match = (sources ?? []).find(
      (s: { label: string }) => s.label.toLowerCase() === String(args.sourceLabel).toLowerCase(),
    )
    if (!match) return { error: `Unknown source "${args.sourceLabel}"` }
    sourceId = match.id
  }

  const { data: inserted, error } = await supabase
    .from('leads')
    .insert({
      name,
      phone,
      property_address: propertyAddress,
      email: (args.email as string) || null,
      timeline_to_sell: (args.timelineToSell as string) || null,
      motivation: (args.motivation as string) || null,
      source: sourceId,
      temperature: (args.temperature as string) || null,
      assigned_to: actor.id,
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: `Could not create lead: ${error?.message}` }

  const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('status', 'active')
  const rows = (admins ?? []).map((a: { id: string }) => ({
    user_id: a.id,
    type: 'new_lead',
    lead_id: inserted.id,
    body: `New lead: ${name} — ${propertyAddress}`,
    read: false,
  }))
  if (rows.length) await supabase.from('notifications').insert(rows)

  await logAudit(supabase, actor, 'lead.created', inserted.id, { name, via: 'chat' })

  return { ok: true, leadId: inserted.id }
}

const UPDATE_FIELD_MAP: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  propertyAddress: 'property_address',
  email: 'email',
  timelineToSell: 'timeline_to_sell',
  motivation: 'motivation',
  notes: 'notes',
  temperature: 'temperature',
  nextFollowUp: 'next_follow_up',
  isOnMarket: 'is_on_market',
  listingUrl: 'listing_url',
  ownerName: 'owner_name',
  ownerPhone: 'owner_phone',
  listingAgentName: 'listing_agent_name',
  listingAgentPhone: 'listing_agent_phone',
  listingAgentBrokerage: 'listing_agent_brokerage',
  arv: 'arv',
  askingPrice: 'asking_price',
  repairEstimate: 'repair_estimate',
  targetOffer: 'target_offer',
  underwritingUrl: 'underwriting_url',
  driveFolderUrl: 'drive_folder_url',
}

async function toolUpdateLead(supabase: DB, actor: Actor, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  if (!leadId) return { error: 'leadId is required' }

  const fields: Record<string, unknown> = {}
  for (const [argKey, column] of Object.entries(UPDATE_FIELD_MAP)) {
    if (args[argKey] !== undefined) fields[column] = args[argKey]
  }

  if (args.sourceLabel !== undefined) {
    if (!args.sourceLabel) {
      fields.source = null
    } else {
      const { data: sources } = await supabase.from('sources').select('id, label')
      const match = (sources ?? []).find(
        (s: { label: string }) => s.label.toLowerCase() === String(args.sourceLabel).toLowerCase(),
      )
      if (!match) return { error: `Unknown source "${args.sourceLabel}"`, validSources: (sources ?? []).map((s: { label: string }) => s.label) }
      fields.source = match.id
    }
  }

  if (args.assignedToName !== undefined) {
    if (!args.assignedToName) {
      fields.assigned_to = null
    } else {
      const { data: people } = await supabase.from('profiles').select('id, full_name, email').in('role', ['admin', 'member'])
      const needle = String(args.assignedToName).toLowerCase()
      const match = (people ?? []).find(
        (p: { full_name: string | null; email: string }) =>
          (p.full_name ?? '').toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
      )
      if (!match) return { error: `Unknown team member "${args.assignedToName}"` }
      fields.assigned_to = match.id
    }
  }

  if (Object.keys(fields).length === 0) return { error: 'No fields to update' }

  const { error } = await supabase.from('leads').update(fields).eq('id', leadId)
  if (error) return { error: `Update failed: ${error.message}` }

  await logAudit(supabase, actor, 'lead.updated', leadId, { fields, via: 'chat' })

  return { ok: true, updatedFields: Object.keys(fields) }
}

async function toolChangeStage(supabase: DB, actor: Actor, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  const toStageLabel = String(args.toStage ?? '').trim()
  if (!leadId || !toStageLabel) return { error: 'leadId and toStage are required' }

  const [{ data: lead }, { data: stages }] = await Promise.all([
    supabase.from('leads').select('id, name, stage, archived_at').eq('id', leadId).single(),
    supabase.from('stages').select('id, label'),
  ])
  if (!lead) return { error: 'Lead not found' }
  if (lead.archived_at) return { error: 'Cannot change stage of an archived lead' }

  const target = (stages ?? []).find((s: { label: string }) => s.label.toLowerCase() === toStageLabel.toLowerCase())
  if (!target) return { error: `Unknown stage "${toStageLabel}"`, validStages: (stages ?? []).map((s: { label: string }) => s.label) }

  const current = (stages ?? []).find((s: { id: string }) => s.id === lead.stage)
  if (current?.id === target.id) return { ok: true, status: 'unchanged', stage: current.label }

  if (!args.confirm) {
    return {
      preview: true,
      message: `This would move "${lead.name}" from "${current?.label ?? 'Unknown'}" to "${target.label}". Call change_stage again with confirm:true to proceed.`,
      from: current?.label ?? null,
      to: target.label,
    }
  }

  const { error } = await supabase.from('leads').update({ stage: target.id }).eq('id', leadId)
  if (error) return { error: `Failed to change stage: ${error.message}` }

  await supabase.from('lead_activity').insert({
    lead_id: leadId,
    author_id: actor.id,
    type: 'note',
    body: `Stage changed from "${current?.label ?? 'Unknown'}" to "${target.label}" via Claude chat.`,
  })
  await logAudit(supabase, actor, 'lead.stage_changed', leadId, { from: current?.label ?? null, to: target.label })

  return { ok: true, status: 'changed', from: current?.label ?? null, to: target.label }
}

async function toolLogActivity(supabase: DB, actor: Actor, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  const body = String(args.body ?? '').trim()
  const type = String(args.type ?? 'note')
  if (!leadId || !body) return { error: 'leadId and body are required' }
  if (!['call', 'text', 'note', 'offer'].includes(type)) {
    return { error: 'type must be one of: call, text, note, offer' }
  }

  const { error } = await supabase.from('lead_activity').insert({ lead_id: leadId, author_id: actor.id, type, body })
  if (error) return { error: `Failed to log activity: ${error.message}` }

  await logAudit(supabase, actor, 'lead.activity_logged', leadId, { type, via: 'chat' })

  return { ok: true }
}

async function toolAddTag(supabase: DB, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  const tagLabel = String(args.tagLabel ?? '').trim()
  if (!leadId || !tagLabel) return { error: 'leadId and tagLabel are required' }

  const { data: tag } = await supabase.from('tags').select('id').ilike('label', tagLabel).single()
  if (!tag) {
    const { data: allTags } = await supabase.from('tags').select('label')
    return { error: `Unknown tag "${tagLabel}"`, validTags: (allTags ?? []).map((t: { label: string }) => t.label) }
  }

  const { error } = await supabase.from('lead_tags').insert({ lead_id: leadId, tag_id: tag.id })
  if (error && !error.message.includes('duplicate')) return { error: `Failed to add tag: ${error.message}` }

  return { ok: true }
}

async function toolRemoveTag(supabase: DB, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  const tagLabel = String(args.tagLabel ?? '').trim()
  if (!leadId || !tagLabel) return { error: 'leadId and tagLabel are required' }

  const { data: tag } = await supabase.from('tags').select('id').ilike('label', tagLabel).single()
  if (!tag) return { error: `Unknown tag "${tagLabel}"` }

  const { error } = await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tag.id)
  if (error) return { error: `Failed to remove tag: ${error.message}` }

  return { ok: true }
}

async function toolArchiveLead(supabase: DB, actor: Actor, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  if (!leadId) return { error: 'leadId is required' }

  const { data: lead } = await supabase.from('leads').select('id, name, property_address, archived_at').eq('id', leadId).single()
  if (!lead) return { error: 'Lead not found' }
  if (lead.archived_at) return { ok: true, status: 'already_archived' }

  if (!args.confirm) {
    return {
      preview: true,
      message: `This would archive "${lead.name}" (${lead.property_address}). It'll be hidden from lists but not deleted. Call archive_lead again with confirm:true to proceed.`,
    }
  }

  const { error } = await supabase.from('leads').update({ archived_at: new Date().toISOString() }).eq('id', leadId)
  if (error) return { error: `Failed to archive: ${error.message}` }

  await supabase.from('lead_activity').insert({
    lead_id: leadId,
    author_id: actor.id,
    type: 'note',
    body: 'Archived via Claude chat.',
  })
  await logAudit(supabase, actor, 'lead.archived', leadId, { name: lead.name, via: 'chat' })

  return { ok: true, status: 'archived' }
}

async function toolPullEnrichment(supabase: DB, actor: Actor, args: Record<string, unknown>) {
  const leadId = String(args.leadId ?? '')
  const type = String(args.type ?? '') as EnrichmentAction
  if (!leadId || !ENRICHMENT_ACTIONS.has(type)) {
    return { error: `leadId and type are required; type must be one of: ${[...ENRICHMENT_ACTIONS].join(', ')}` }
  }

  const result = await runEnrichment(supabase, type, leadId, actor.id)
  if (!result.ok && result.status === 'error') return { error: result.error }
  return { status: result.status, summary: result.summary }
}

async function toolListAttentionItems(supabase: DB) {
  const [leadsRes, stagesRes, sourcesRes, activityRes, profilesRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, property_address, temperature, stage, assigned_to, source, next_follow_up, created_at')
      .is('archived_at', null),
    supabase.from('stages').select('id, label, sort_order, is_terminal'),
    supabase.from('sources').select('id, label'),
    supabase.from('lead_activity').select('lead_id, created_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email'),
  ])

  const nameById = new Map(
    (profilesRes.data ?? []).map((p: { id: string; full_name: string | null; email: string }) => [
      p.id,
      p.full_name || p.email,
    ]),
  )
  const sourceLabelById = new Map((sourcesRes.data ?? []).map((s: { id: string; label: string }) => [s.id, s.label]))
  const stages = stagesRes.data ?? []
  const terminalIds = new Set(stages.filter((s: { is_terminal: boolean }) => s.is_terminal).map((s: { id: string }) => s.id))
  const underContractId = stages.find((s: { label: string }) => s.label === 'Under Contract')?.id
  const earliestActiveStageId = [...stages]
    .filter((s: { is_terminal: boolean }) => !s.is_terminal)
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)[0]?.id

  const lastByLead: Record<string, string> = {}
  for (const a of activityRes.data ?? []) {
    if (!lastByLead[a.lead_id]) lastByLead[a.lead_id] = a.created_at
  }
  const todayStr = todayISODate()
  const PRIORITY = { new_foreclosure: 1, under_contract_quiet: 2, follow_up_due: 3, foreclosure_quiet: 4, hot_quiet: 5 }
  // deno-lint-ignore no-explicit-any
  const items: any[] = []

  for (const lead of leadsRes.data ?? []) {
    if (terminalIds.has(lead.stage)) continue
    const isForeclosure = sourceLabelById.get(lead.source) === FORECLOSURE_SOURCE_LABEL
    const quietDays = daysSince(lastByLead[lead.id] || lead.created_at)

    let item: { priority: number; tag?: string; reason: string } | null = null
    if (isForeclosure && earliestActiveStageId && lead.stage === earliestActiveStageId) {
      item = { priority: PRIORITY.new_foreclosure, tag: 'Foreclosure', reason: 'New foreclosure lead — reach out today' }
    } else if (underContractId && lead.stage === underContractId && quietDays >= 2) {
      item = { priority: PRIORITY.under_contract_quiet, reason: `Under contract, no activity in ${quietDays}d — check in` }
    } else if (lead.next_follow_up && lead.next_follow_up <= todayStr) {
      item = {
        priority: PRIORITY.follow_up_due,
        reason: lead.next_follow_up === todayStr ? 'Follow-up due today' : `Follow-up overdue since ${lead.next_follow_up}`,
      }
    } else if (isForeclosure && quietDays >= 1) {
      item = { priority: PRIORITY.foreclosure_quiet, tag: 'Foreclosure', reason: `Foreclosure lead, no activity in ${quietDays}d — time-sensitive` }
    } else if (lead.temperature === 'Hot' && quietDays >= 3) {
      item = { priority: PRIORITY.hot_quiet, reason: `Hot lead, no activity in ${quietDays}d` }
    }

    if (item) {
      items.push({
        ...item,
        leadId: lead.id,
        name: lead.name,
        propertyAddress: lead.property_address,
        assignedTo: nameById.get(lead.assigned_to) ?? null,
      })
    }
  }

  items.sort((a, b) => a.priority - b.priority)
  return { count: items.length, items }
}

async function toolListFollowUps(supabase: DB) {
  const todayStr = todayISODate()
  const [stagesRes, leadsRes, sourcesRes, profilesRes] = await Promise.all([
    supabase.from('stages').select('id, is_terminal'),
    supabase
      .from('leads')
      .select('id, name, phone, property_address, temperature, next_follow_up, stage, assigned_to, source')
      .is('archived_at', null)
      .lte('next_follow_up', todayStr)
      .order('next_follow_up', { ascending: true }),
    supabase.from('sources').select('id, label'),
    supabase.from('profiles').select('id, full_name, email'),
  ])

  const terminalIds = new Set(
    (stagesRes.data ?? []).filter((s: { is_terminal: boolean }) => s.is_terminal).map((s: { id: string }) => s.id),
  )
  const sourceLabelById = new Map((sourcesRes.data ?? []).map((s: { id: string; label: string }) => [s.id, s.label]))
  const nameById = new Map(
    (profilesRes.data ?? []).map((p: { id: string; full_name: string | null; email: string }) => [
      p.id,
      p.full_name || p.email,
    ]),
  )
  const filtered = (leadsRes.data ?? []).filter((l: { next_follow_up: string | null; stage: string }) => l.next_follow_up && !terminalIds.has(l.stage))

  filtered.sort((a: { source: string; next_follow_up: string }, b: { source: string; next_follow_up: string }) => {
    const af = sourceLabelById.get(a.source) === FORECLOSURE_SOURCE_LABEL ? 0 : 1
    const bf = sourceLabelById.get(b.source) === FORECLOSURE_SOURCE_LABEL ? 0 : 1
    return af - bf || a.next_follow_up.localeCompare(b.next_follow_up)
  })

  return {
    count: filtered.length,
    // deno-lint-ignore no-explicit-any
    followUps: filtered.map((l: any) => ({
      leadId: l.id,
      name: l.name,
      phone: l.phone,
      propertyAddress: l.property_address,
      temperature: l.temperature,
      dueDate: l.next_follow_up,
      overdue: l.next_follow_up < todayStr,
      isForeclosure: sourceLabelById.get(l.source) === FORECLOSURE_SOURCE_LABEL,
      assignedTo: nameById.get(l.assigned_to) ?? null,
    })),
  }
}

// ---------- MCP protocol plumbing ----------

const TOOLS = [
  {
    name: 'search_leads',
    description: 'Search leads by name, phone, email, or property address (partial match, case-insensitive). Returns up to 20 matches with stage/temperature/source/tags/owner already resolved to readable labels.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search text' } },
      required: ['query'],
    },
  },
  {
    name: 'get_lead',
    description: 'Full detail for one lead: contact info, stage, tags, ownership/listing/underwriting fields, last 10 activity entries, and latest pulled enrichment data (property/value/rent/skip-trace).',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string', description: 'Lead UUID, from search_leads' } },
      required: ['leadId'],
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead. Checks for existing leads with the same phone or address first and returns a warning instead of creating unless confirmDuplicate is true.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string', description: 'Digits only or any format — non-digits are stripped' },
        propertyAddress: { type: 'string' },
        email: { type: 'string' },
        timelineToSell: { type: 'string' },
        motivation: { type: 'string' },
        temperature: { type: 'string', enum: ['Hot', 'Warm', 'Cold'] },
        sourceLabel: { type: 'string', description: 'e.g. "Facebook ad", "Cold Call" — must match an existing source' },
        confirmDuplicate: { type: 'boolean', description: 'Set true to create anyway after a duplicate warning' },
      },
      required: ['name', 'phone', 'propertyAddress'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update one or more fields on an existing lead. Only pass the fields you want to change. Does not handle stage (use change_stage) or archiving (use archive_lead).',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        propertyAddress: { type: 'string' },
        email: { type: 'string' },
        timelineToSell: { type: 'string' },
        motivation: { type: 'string' },
        notes: { type: 'string' },
        temperature: { type: 'string', enum: ['Hot', 'Warm', 'Cold'] },
        nextFollowUp: { type: 'string', description: 'ISO date, e.g. 2026-08-01' },
        sourceLabel: { type: 'string' },
        assignedToName: { type: 'string', description: 'Team member name or email; empty string to unassign' },
        isOnMarket: { type: 'boolean' },
        listingUrl: { type: 'string' },
        ownerName: { type: 'string' },
        ownerPhone: { type: 'string' },
        listingAgentName: { type: 'string' },
        listingAgentPhone: { type: 'string' },
        listingAgentBrokerage: { type: 'string' },
        arv: { type: 'number' },
        askingPrice: { type: 'number' },
        repairEstimate: { type: 'number' },
        targetOffer: { type: 'number' },
        underwritingUrl: { type: 'string' },
        driveFolderUrl: { type: 'string' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'change_stage',
    description: 'Move a lead to a different pipeline stage. Any stage transition is allowed (forward, backward, or to a terminal stage like Closed/Dead) — unlike the automated foreclosure-monitor integration, there is no whitelist here. Call once WITHOUT confirm to get a preview, then call again WITH confirm:true only after the user has explicitly agreed in chat.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        toStage: { type: 'string', description: 'Target stage label, e.g. "Contacted", "Under Contract", "Closed"' },
        confirm: { type: 'boolean' },
      },
      required: ['leadId', 'toStage'],
    },
  },
  {
    name: 'log_activity',
    description: 'Log a call, text, note, or offer against a lead — the same as the "Log activity" box in the app.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        type: { type: 'string', enum: ['call', 'text', 'note', 'offer'] },
        body: { type: 'string' },
      },
      required: ['leadId', 'type', 'body'],
    },
  },
  {
    name: 'add_tag',
    description: 'Add an existing tag (e.g. Foreclosure, FSBO, Tired Landlord, Expired Listing) to a lead.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string' }, tagLabel: { type: 'string' } },
      required: ['leadId', 'tagLabel'],
    },
  },
  {
    name: 'remove_tag',
    description: 'Remove a tag from a lead.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string' }, tagLabel: { type: 'string' } },
      required: ['leadId', 'tagLabel'],
    },
  },
  {
    name: 'archive_lead',
    description: 'Soft-delete (archive) a lead — hides it from lists without deleting data; recoverable. Call once WITHOUT confirm to get a preview, then again WITH confirm:true only after the user has explicitly agreed in chat.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['leadId'],
    },
  },
  {
    name: 'pull_enrichment',
    description: 'Pull live external data for a lead — costs real money per pull (RentCast ~$0.02-0.20/call, Tracerfy ~$0.10/skip-trace hit, free on miss) so only call this when the user actually asks for it, never speculatively.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        type: { type: 'string', enum: ['property_lookup', 'value_estimate', 'rent_estimate', 'skip_trace'] },
      },
      required: ['leadId', 'type'],
    },
  },
  {
    name: 'list_attention_items',
    description: 'The same priority feed shown on the app dashboard: new/quiet foreclosure leads, Under Contract deals gone quiet, due/overdue follow-ups, Hot leads gone quiet — in that priority order. Use this for "what needs my attention" type questions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_follow_ups',
    description: 'Leads with a follow-up due today or earlier, not in a terminal stage — foreclosure leads sorted first regardless of exact date. Use this for "what follow-ups do I have today" type questions.',
    inputSchema: { type: 'object', properties: {} },
  },
]

async function dispatchTool(supabase: DB, actor: Actor, name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'search_leads':
      return await toolSearchLeads(supabase, args)
    case 'get_lead':
      return await toolGetLead(supabase, args)
    case 'create_lead':
      return await toolCreateLead(supabase, actor, args)
    case 'update_lead':
      return await toolUpdateLead(supabase, actor, args)
    case 'change_stage':
      return await toolChangeStage(supabase, actor, args)
    case 'log_activity':
      return await toolLogActivity(supabase, actor, args)
    case 'add_tag':
      return await toolAddTag(supabase, args)
    case 'remove_tag':
      return await toolRemoveTag(supabase, args)
    case 'archive_lead':
      return await toolArchiveLead(supabase, actor, args)
    case 'pull_enrichment':
      return await toolPullEnrichment(supabase, actor, args)
    case 'list_attention_items':
      return await toolListAttentionItems(supabase)
    case 'list_follow_ups':
      return await toolListFollowUps(supabase)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

function mcpResponse(req: Request, payload: unknown, status = 200): Response {
  const accept = req.headers.get('Accept') ?? ''
  if (accept.includes('text/event-stream')) {
    return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    })
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const token = segments.at(-1)

  if (!token || token === 'crm-mcp') {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const tokenHash = await sha256Hex(token)
  const { data: tokenRow } = await supabase.from('api_tokens').select('id, profile_id').eq('token_hash', tokenHash).single()
  if (!tokenRow) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const { data: actor } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status')
    .eq('id', tokenRow.profile_id)
    .single()
  if (!actor || actor.status !== 'active' || !['admin', 'member'].includes(actor.role)) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  supabase.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id).then(() => {})

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return mcpResponse(req, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }, 400)
  }

  const { jsonrpc, id, method, params } = body as {
    jsonrpc: string
    id?: number | string
    method: string
    params?: Record<string, unknown>
  }

  // Notifications (no id) get no response body per JSON-RPC, but Deno.serve
  // still needs a Response — an empty 202 is fine, the client isn't
  // listening for a reply.
  if (id === undefined) {
    return new Response(null, { status: 202, headers: corsHeaders })
  }

  try {
    if (method === 'initialize') {
      return mcpResponse(req, {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'uchb-crm', version: '1.0.0' },
        },
      })
    }

    if (method === 'tools/list') {
      return mcpResponse(req, { jsonrpc: '2.0', id, result: { tools: TOOLS } })
    }

    if (method === 'resources/list') {
      return mcpResponse(req, { jsonrpc: '2.0', id, result: { resources: [] } })
    }

    if (method === 'prompts/list') {
      return mcpResponse(req, { jsonrpc: '2.0', id, result: { prompts: [] } })
    }

    if (method === 'ping') {
      return mcpResponse(req, { jsonrpc: '2.0', id, result: {} })
    }

    if (method === 'tools/call') {
      const toolName = String(params?.name ?? '')
      const toolArgs = (params?.arguments as Record<string, unknown>) ?? {}
      const result = await dispatchTool(supabase, actor as Actor, toolName, toolArgs)
      const isError = result && typeof result === 'object' && 'error' in result
      return mcpResponse(req, {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }], isError: Boolean(isError) },
      })
    }

    return mcpResponse(req, { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
  } catch (err) {
    console.error(`crm-mcp: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    return mcpResponse(req, {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Internal error' },
    })
  }
})
