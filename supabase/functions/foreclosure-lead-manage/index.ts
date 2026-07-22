import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SOURCE_LABEL = 'Foreclosure Monitor'

// Deliberately excludes pipeline-management fields (stage, assigned_to,
// temperature) and identity fields (name, property_address) — those stay
// human-only, changed through the app. This endpoint is for the monitoring
// data Hermes actually owns: contact details and what it's observed.
const UPDATABLE_FIELDS = new Set(['notes', 'asking_price', 'is_on_market', 'phone', 'email', 'timeline_to_sell', 'motivation'])

type ManagePayload = {
  action?: 'update' | 'archive'
  leadId?: string
  fields?: Record<string, unknown>
}

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

  if (action !== 'update' && action !== 'archive') {
    return json({ error: "action must be 'update' or 'archive'" }, 400)
  }
  if (!leadId || typeof leadId !== 'string') {
    return json({ error: 'leadId is required' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  try {
    // Scope check: Hermes may only touch leads it created itself. This is
    // the whole point of Option A — a bad instruction can't reach a lead
    // that's actually being worked by the team.
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, property_address, archived_at, source, sources(label)')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return json({ error: 'Lead not found' }, 404)
    }

    const sourceLabel = (lead as unknown as { sources: { label: string } | null }).sources?.label
    if (sourceLabel !== SOURCE_LABEL) {
      console.error(`foreclosure-lead-manage: rejected out-of-scope leadId ${leadId} (source: ${sourceLabel ?? 'none'})`)
      return json({ error: 'This lead was not created by the foreclosure monitor — out of scope' }, 403)
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

    // action === 'update'
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
  } catch (err) {
    console.error(
      `foreclosure-lead-manage: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    )
    return json({ error: 'Internal error' }, 500)
  }
})
