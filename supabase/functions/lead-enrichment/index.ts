import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// On-demand data enrichment — only ever runs when a signed-in team member
// clicks a button on the lead detail page. Never automatic, never on a
// schedule: these calls cost real money per pull.

type Action = 'property_lookup' | 'value_estimate' | 'rent_estimate' | 'skip_trace'

type Payload = {
  action?: Action
  leadId?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// "123 Main St, Cookeville, TN 38501" -> parts. Tracerfy's lookup endpoint
// needs street/city/state/zip separately; RentCast accepts the combined
// string directly, so only skip_trace needs this.
function parseAddress(address: string): { street: string; city: string; state: string; zip: string } | null {
  const match = address.match(/^(.+?),\s*(.+?),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/)
  if (!match) return null
  return { street: match[1].trim(), city: match[2].trim(), state: match[3].toUpperCase(), zip: match[4] }
}

function latestYearEntry(obj: Record<string, unknown> | null | undefined): unknown {
  if (!obj || typeof obj !== 'object') return null
  const years = Object.keys(obj).filter((k) => /^\d{4}$/.test(k))
  if (years.length === 0) return null
  const latest = years.sort().at(-1) as string
  return obj[latest]
}

async function rentcastFetch(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.rentcast.io/v1${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return fetch(url, {
    headers: { 'X-Api-Key': Deno.env.get('RENTCAST_API_KEY') ?? '', Accept: 'application/json' },
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

  const VALID_ACTIONS = new Set<Action>(['property_lookup', 'value_estimate', 'rent_estimate', 'skip_trace'])
  const { action, leadId } = payload
  if (!action || !VALID_ACTIONS.has(action)) {
    return json({ error: `action must be one of: ${[...VALID_ACTIONS].join(', ')}` }, 400)
  }
  if (!leadId || typeof leadId !== 'string') {
    return json({ error: 'leadId is required' }, 400)
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, property_address, county')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    return json({ error: 'Lead not found' }, 404)
  }
  if (!lead.property_address) {
    return json({ error: 'Lead has no property address to look up' }, 400)
  }

  try {
    if (action === 'skip_trace') {
      const addr = parseAddress(lead.property_address)
      if (!addr) {
        return json(
          {
            error: `Could not parse "${lead.property_address}" into street/city/state/zip. Expected format: "Street, City, ST ZIP".`,
          },
          400,
        )
      }

      const res = await fetch('https://www.tracerfy.com/v1/api/trace/lookup/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('TRACERFY_API_KEY') ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: addr.street, city: addr.city, state: addr.state, zip: addr.zip }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        const message = errBody?.error ?? `Tracerfy error ${res.status}`
        await supabase.from('lead_enrichments').insert({
          lead_id: leadId,
          type: 'skip_trace',
          provider: 'tracerfy',
          status: 'error',
          requested_by: user.id,
          summary: { error: message },
          raw_response: errBody,
        })
        return json({ error: message }, res.status)
      }
      const data = await res.json()

      // Real shape (verified against a live hit): name/phones/emails/mailing
      // address live per-person inside a `persons` array, not top-level —
      // an address can return more than one match (e.g. prior + current
      // owner), so we keep all of them rather than assuming persons[0].
      const status = data.hit ? 'success' : 'no_match'
      const summary = data.hit
        ? {
            personsCount: data.persons_count ?? (data.persons ?? []).length,
            people: (data.persons ?? []).map((person: Record<string, unknown>) => {
              const mailing = person.mailing_address as Record<string, unknown> | undefined
              return {
                name: person.full_name ?? ([person.first_name, person.last_name].filter(Boolean).join(' ') || null),
                deceased: Boolean(person.deceased),
                litigator: Boolean(person.litigator),
                phones: ((person.phones as Record<string, unknown>[]) ?? []).map((p) => ({
                  number: p.number,
                  type: p.type,
                  dnc: Boolean(p.dnc),
                  tcpa: Boolean(p.tcpa),
                })),
                emails: ((person.emails as Record<string, unknown>[]) ?? []).map((e) =>
                  typeof e === 'string' ? e : e.email,
                ),
                mailingAddress: mailing
                  ? [mailing.street, mailing.city, mailing.state, mailing.zip].filter(Boolean).join(', ')
                  : null,
              }
            }),
          }
        : null
      // Tracerfy: 5 credits/hit, free on miss, ~$0.02/credit at standard rates.
      const costCents = data.hit ? (data.credits_deducted ?? 5) * 2 : 0

      await supabase.from('lead_enrichments').insert({
        lead_id: leadId,
        type: 'skip_trace',
        provider: 'tracerfy',
        status,
        requested_by: user.id,
        summary,
        raw_response: data,
        cost_cents: costCents,
      })

      return json({ ok: true, status, summary })
    }

    if (action === 'property_lookup') {
      const res = await rentcastFetch('/properties', { address: lead.property_address })
      if (res.status === 404) {
        await supabase.from('lead_enrichments').insert({
          lead_id: leadId,
          type: 'property_lookup',
          provider: 'rentcast',
          status: 'no_match',
          requested_by: user.id,
        })
        return json({ ok: true, status: 'no_match' })
      }
      if (!res.ok) throw new Error(`RentCast error ${res.status}: ${await res.text()}`)

      const data = await res.json()
      const record = Array.isArray(data) ? data[0] : data
      if (!record) {
        await supabase.from('lead_enrichments').insert({
          lead_id: leadId,
          type: 'property_lookup',
          provider: 'rentcast',
          status: 'no_match',
          requested_by: user.id,
          raw_response: data,
        })
        return json({ ok: true, status: 'no_match' })
      }

      const summary = {
        owner: record.owner?.names?.[0] ?? null,
        ownerType: record.owner?.type ?? null,
        ownerOccupied: record.ownerOccupied ?? null,
        ownerMailingAddress: record.owner?.mailingAddress
          ? [
              record.owner.mailingAddress.addressLine1,
              record.owner.mailingAddress.city,
              record.owner.mailingAddress.state,
              record.owner.mailingAddress.zipCode,
            ]
              .filter(Boolean)
              .join(', ')
          : null,
        county: record.county ?? null,
        assessorID: record.assessorID ?? null,
        latestTaxAssessment: latestYearEntry(record.taxAssessments),
        latestPropertyTax: latestYearEntry(record.propertyTaxes),
      }

      if (summary.county && !lead.county) {
        await supabase.from('leads').update({ county: summary.county }).eq('id', leadId)
      }

      await supabase.from('lead_enrichments').insert({
        lead_id: leadId,
        type: 'property_lookup',
        provider: 'rentcast',
        status: 'success',
        requested_by: user.id,
        summary,
        raw_response: record,
      })

      return json({ ok: true, status: 'success', summary })
    }

    // action === 'value_estimate' | 'rent_estimate'
    const path = action === 'value_estimate' ? '/avm/value' : '/avm/rent/long-term'
    const res = await rentcastFetch(path, { address: lead.property_address })
    if (!res.ok) {
      const status = res.status === 404 ? 'no_match' : 'error'
      await supabase.from('lead_enrichments').insert({
        lead_id: leadId,
        type: action,
        provider: 'rentcast',
        status,
        requested_by: user.id,
      })
      if (status === 'no_match') return json({ ok: true, status: 'no_match' })
      throw new Error(`RentCast error ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    // Field names below are best-effort based on RentCast's public docs —
    // raw_response is always stored, so nothing is lost even if a field
    // name has since changed; verify against a live response once wired up.
    const summary =
      action === 'value_estimate'
        ? {
            estimatedValue: data.price ?? data.estimatedValue ?? null,
            low: data.priceRangeLow ?? data.valueRangeLow ?? null,
            high: data.priceRangeHigh ?? data.valueRangeHigh ?? null,
            comparableCount: Array.isArray(data.comparables) ? data.comparables.length : 0,
          }
        : {
            estimatedRent: data.rent ?? data.estimatedRent ?? null,
            low: data.rentRangeLow ?? null,
            high: data.rentRangeHigh ?? null,
            comparableCount: Array.isArray(data.comparables) ? data.comparables.length : 0,
          }

    await supabase.from('lead_enrichments').insert({
      lead_id: leadId,
      type: action,
      provider: 'rentcast',
      status: 'success',
      requested_by: user.id,
      summary,
      raw_response: data,
    })

    return json({ ok: true, status: 'success', summary })
  } catch (err) {
    console.error(`lead-enrichment: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    await supabase.from('lead_enrichments').insert({
      lead_id: leadId,
      type: action,
      provider: action === 'skip_trace' ? 'tracerfy' : 'rentcast',
      status: 'error',
      requested_by: user.id,
      summary: { error: err instanceof Error ? err.message : String(err) },
    })
    return json({ error: 'Lookup failed' }, 500)
  }
})
