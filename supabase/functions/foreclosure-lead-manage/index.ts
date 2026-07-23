import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SOURCE_LABEL = 'Foreclosure Monitor'

// Deliberately excludes pipeline-management fields (stage, assigned_to,
// temperature) and identity fields (name, property_address) — those stay
// human-only, changed through the app. This endpoint is for the monitoring
// data Hermes actually owns: contact details and what it's observed.
const UPDATABLE_FIELDS = new Set(['notes', 'asking_price', 'is_on_market', 'phone', 'email', 'timeline_to_sell', 'motivation'])

const ACTIVITY_TYPES = new Set(['call', 'text', 'note', 'offer'])

type ManagePayload = {
  action?: 'update' | 'archive' | 'search' | 'log_note' | 'change_stage'
  leadId?: string
  fields?: Record<string, unknown>
  query?: string
  body?: string
  type?: string
  toStage?: string
}

type StageRow = { id: string; label: string; sort_order: number; is_terminal: boolean }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// The only forward, single-step transitions between non-terminal stages,
// derived from stages.sort_order at request time (never hard-coded) — so
// this stays correct if the pipeline's stages are ever edited. Anything
// reaching a terminal stage (is_terminal = true), any backward move, and
// any skipped stage are all rejected — those stay a human decision made
// in the app.
function buildAllowedTransitions(stages: StageRow[]): Map<string, string> {
  const active = [...stages].filter((s) => !s.is_terminal).sort((a, b) => a.sort_order - b.sort_order)
  const allowed = new Map<string, string>()
  for (let i = 0; i < active.length - 1; i++) {
    allowed.set(active[i].label, active[i + 1].label)
  }
  return allowed
}

async function handleSearch(supabase: ReturnType<typeof createClient>, query: string) {
  const term = query.trim()
  if (!term) return json({ error: 'query is required' }, 400)

  const SELECT = 'id, name, phone, property_address, email, stage, temperature, notes, assigned_to, next_follow_up, archived_at'
  const digits = term.replace(/\D/g, '')

  const lookups = [
    supabase.from('leads').select(SELECT).ilike('name', `%${term}%`).limit(10),
    supabase.from('leads').select(SELECT).ilike('property_address', `%${term}%`).limit(10),
    supabase.from('leads').select(SELECT).ilike('email', `%${term}%`).limit(10),
  ]
  if (digits.length >= 3) {
    lookups.push(supabase.from('leads').select(SELECT).ilike('phone', `%${digits}%`).limit(10))
  }

  const results = await Promise.all(lookups)
  for (const r of results) {
    if (r.error) throw new Error(`Search failed: ${r.error.message}`)
  }

  const byId = new Map<string, Record<string, unknown>>()
  for (const r of results) {
    for (const row of (r.data ?? []) as Record<string, unknown>[]) {
      byId.set(row.id as string, row)
    }
  }

  const leadRows = [...byId.values()].slice(0, 20)
  const [{ data: stages }, { data: profiles }] = await Promise.all([
    supabase.from('stages').select('id, label'),
    supabase.from('profiles').select('id, full_name, email'),
  ])
  const stageLabelById = new Map((stages ?? []).map((s: { id: string; label: string }) => [s.id, s.label]))
  const nameById = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; email: string }) => [p.id, p.full_name || p.email]),
  )

  const leads = leadRows.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    propertyAddress: l.property_address,
    stage: stageLabelById.get(l.stage as string) ?? null,
    temperature: l.temperature,
    notes: l.notes,
    assignedTo: nameById.get(l.assigned_to as string) ?? null,
    nextFollowUp: l.next_follow_up,
    archived: Boolean(l.archived_at),
  }))

  await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'lead.hermes_searched',
    lead_id: null,
    details: { query: term, resultCount: leads.length },
  })

  return json({ ok: true, count: leads.length, leads })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const expectedToken = Deno.env.get('FORECLOSURE_MANAGE_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!expectedToken || !providedToken || !timingSafeEqual(providedToken, expectedToken)) {
    console.error('foreclosure-lead-manage: unauthorized request')
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: ManagePayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { action, leadId } = payload
  const VALID_ACTIONS = new Set(['update', 'archive', 'search', 'log_note', 'change_stage'])
  if (!action || !VALID_ACTIONS.has(action)) {
    return json({ error: `action must be one of: ${[...VALID_ACTIONS].join(', ')}` }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  try {
    // search is the only action that isn't scoped to a single lead.
    if (action === 'search') {
      return await handleSearch(supabase, payload.query ?? '')
    }

    if (!leadId || typeof leadId !== 'string') {
      return json({ error: 'leadId is required' }, 400)
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, property_address, stage, archived_at, source, sources(label)')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return json({ error: 'Lead not found' }, 404)
    }

    // update/archive stay scoped to leads Hermes created itself — the whole
    // point of Option A from the original design is that a bad instruction
    // can't reach a lead actually being worked by the team. search/log_note/
    // change_stage are content-guarded instead (read-only, append-only, and
    // a server-enforced transition whitelist, respectively), so they're safe
    // to open to every lead regardless of source.
    if (action === 'update' || action === 'archive') {
      const sourceLabel = (lead as unknown as { sources: { label: string } | null }).sources?.label
      if (sourceLabel !== SOURCE_LABEL) {
        console.error(`foreclosure-lead-manage: rejected out-of-scope leadId ${leadId} (source: ${sourceLabel ?? 'none'})`)
        return json({ error: 'This lead was not created by the foreclosure monitor — out of scope' }, 403)
      }
    }

    if (action === 'archive') {
      if (lead.archived_at) {
        return json({ ok: true, status: 'already_archived', leadId })
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', leadId)

      if (updateError) throw new Error(`Failed to archive lead: ${updateError.message}`)

      await supabase.from('lead_activity').insert({
        lead_id: leadId,
        author_id: null,
        type: 'note',
        body: 'Archived by Hermes (foreclosure monitor).',
      })

      await supabase.from('audit_log').insert({
        actor_id: null,
        action: 'lead.hermes_archived',
        lead_id: leadId,
        details: { name: lead.name, property_address: lead.property_address },
      })

      return json({ ok: true, status: 'archived', leadId })
    }

    if (action === 'update') {
      const fields = payload.fields
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        return json({ error: 'fields object is required for update' }, 400)
      }

      const keys = Object.keys(fields)
      const rejected = keys.filter((k) => !UPDATABLE_FIELDS.has(k))
      if (rejected.length > 0) {
        return json(
          { error: `Field(s) not updatable by this endpoint: ${rejected.join(', ')}`, updatableFields: [...UPDATABLE_FIELDS] },
          400,
        )
      }
      if (keys.length === 0) {
        return json({ error: 'fields object is empty' }, 400)
      }
      if (lead.archived_at) {
        return json({ error: 'Cannot update an archived lead' }, 409)
      }

      const { error: updateError } = await supabase.from('leads').update(fields).eq('id', leadId)
      if (updateError) throw new Error(`Failed to update lead: ${updateError.message}`)

      await supabase.from('lead_activity').insert({
        lead_id: leadId,
        author_id: null,
        type: 'note',
        body: `Updated by Hermes (foreclosure monitor): ${keys.join(', ')}.`,
      })

      await supabase.from('audit_log').insert({
        actor_id: null,
        action: 'lead.hermes_updated',
        lead_id: leadId,
        details: { fields },
      })

      return json({ ok: true, status: 'updated', leadId, updatedFields: keys })
    }

    if (action === 'log_note') {
      const body = typeof payload.body === 'string' ? payload.body.trim() : ''
      if (!body) return json({ error: 'body is required for log_note' }, 400)

      const activityType = typeof payload.type === 'string' ? payload.type : 'note'
      if (!ACTIVITY_TYPES.has(activityType)) {
        return json({ error: `type must be one of: ${[...ACTIVITY_TYPES].join(', ')}`, allowedTypes: [...ACTIVITY_TYPES] }, 400)
      }

      const { error: insertError } = await supabase.from('lead_activity').insert({
        lead_id: leadId,
        author_id: null,
        type: activityType,
        body,
      })
      if (insertError) throw new Error(`Failed to log activity: ${insertError.message}`)

      await supabase.from('audit_log').insert({
        actor_id: null,
        action: 'lead.hermes_logged_note',
        lead_id: leadId,
        details: { type: activityType, body },
      })

      return json({ ok: true, status: 'logged', leadId, type: activityType })
    }

    // action === 'change_stage'
    const toStageLabel = typeof payload.toStage === 'string' ? payload.toStage.trim() : ''
    if (!toStageLabel) return json({ error: 'toStage is required (a stage label, e.g. "Contacted")' }, 400)
    if (lead.archived_at) return json({ error: 'Cannot change stage of an archived lead' }, 409)

    const { data: stages, error: stagesError } = await supabase
      .from('stages')
      .select('id, label, sort_order, is_terminal')
    if (stagesError || !stages) throw new Error(`Failed to load stages: ${stagesError?.message}`)

    const stagesTyped = stages as StageRow[]
    const stageById = new Map(stagesTyped.map((s) => [s.id, s]))
    const stageByLabelLower = new Map(stagesTyped.map((s) => [s.label.toLowerCase(), s]))

    const currentStage = stageById.get(lead.stage as string)
    const targetStage = stageByLabelLower.get(toStageLabel.toLowerCase())

    if (!targetStage) {
      return json(
        { error: `Unknown stage "${toStageLabel}"`, validStages: stagesTyped.map((s) => s.label) },
        400,
      )
    }
    if (!currentStage) {
      // Shouldn't happen — every lead has a stage — but fail closed rather
      // than guess.
      return json({ error: 'Could not resolve lead’s current stage' }, 500)
    }

    if (currentStage.id === targetStage.id) {
      return json({ ok: true, status: 'unchanged', leadId, stage: currentStage.label })
    }

    const allowed = buildAllowedTransitions(stagesTyped)
    const allowedNext = allowed.get(currentStage.label) ?? null

    if (allowedNext !== targetStage.label) {
      console.error(
        `foreclosure-lead-manage: rejected stage transition for lead ${leadId}: ${currentStage.label} -> ${targetStage.label}`,
      )
      return json(
        {
          error: `Transition "${currentStage.label}" → "${targetStage.label}" is not allowed. Stage changes may only move one step forward through the active pipeline; reaching a terminal stage is a human decision made in the app.`,
          from: currentStage.label,
          to: targetStage.label,
          allowedNextStage: allowedNext,
        },
        403,
      )
    }

    const { error: stageUpdateError } = await supabase.from('leads').update({ stage: targetStage.id }).eq('id', leadId)
    if (stageUpdateError) throw new Error(`Failed to change stage: ${stageUpdateError.message}`)

    await supabase.from('lead_activity').insert({
      lead_id: leadId,
      author_id: null,
      type: 'note',
      body: `Stage changed from "${currentStage.label}" to "${targetStage.label}" by Hermes.`,
    })

    await supabase.from('audit_log').insert({
      actor_id: null,
      action: 'lead.hermes_stage_changed',
      lead_id: leadId,
      details: { from: currentStage.label, to: targetStage.label },
    })

    return json({ ok: true, status: 'stage_changed', leadId, from: currentStage.label, to: targetStage.label })
  } catch (err) {
    console.error(
      `foreclosure-lead-manage: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    )
    return json({ error: 'Internal error' }, 500)
  }
})
