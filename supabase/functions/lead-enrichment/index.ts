import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { ENRICHMENT_ACTIONS, runEnrichment, type EnrichmentAction } from '../_shared/enrichment.ts'

// On-demand data enrichment — only ever runs when a signed-in team member
// clicks a button on the lead detail page. Never automatic, never on a
// schedule: these calls cost real money per pull.

type Payload = {
  action?: EnrichmentAction
  leadId?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Standard Supabase Auth JWT (platform-verified) identifies the caller;
  // we additionally check role ourselves before spending money on their
  // behalf, since a stale/disabled account slipping through here has a
  // real dollar cost attached, unlike a normal read.
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', user.id).single()
  if (!profile || profile.status !== 'active' || !['admin', 'member'].includes(profile.role)) {
    return json({ error: 'Forbidden' }, 403)
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { action, leadId } = payload
  if (!action || !ENRICHMENT_ACTIONS.has(action)) {
    return json({ error: `action must be one of: ${[...ENRICHMENT_ACTIONS].join(', ')}` }, 400)
  }
  if (!leadId || typeof leadId !== 'string') {
    return json({ error: 'leadId is required' }, 400)
  }

  const result = await runEnrichment(supabase, action, leadId, user.id)
  if (!result.ok && result.status === 'error') {
    return json({ error: result.error }, result.httpStatus)
  }
  return json({ ok: true, status: result.status, summary: result.summary }, result.httpStatus)
})
