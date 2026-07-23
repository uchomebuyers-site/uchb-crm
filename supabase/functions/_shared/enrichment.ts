import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Shared by lead-enrichment (JWT-authenticated app users) and crm-mcp
// (per-person bearer tokens) — same external calls, same DB writes,
// different auth wrapping. Field names here are verified against real
// live responses, not just docs (see git history for the specific test
// calls) — don't second-guess them without a fresh live check.

export type EnrichmentAction = 'property_lookup' | 'value_estimate' | 'rent_estimate' | 'skip_trace'

export const ENRICHMENT_ACTIONS = new Set<EnrichmentAction>([
  'property_lookup',
  'value_estimate',
  'rent_estimate',
  'skip_trace',
])

export type EnrichmentResult = {
  ok: boolean
  status: 'success' | 'no_match' | 'error'
  summary?: unknown
  error?: string
  httpStatus: number
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

export async function runEnrichment(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  action: EnrichmentAction,
  leadId: string,
  requestedBy: string | null,
): Promise<EnrichmentResult> {
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, property_address, county')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    return { ok: false, status: 'error', error: 'Lead not found', httpStatus: 404 }
  }
  if (!lead.property_address) {
    return { ok: false, status: 'error', error: 'Lead has no property address to look up', httpStatus: 400 }
  }

  try {
    if (action === 'skip_trace') {
      const addr = parseAddress(lead.property_address)
      if (!addr) {
        return {
          ok: false,
          status: 'error',
          error: `Could not parse "${lead.property_address}" into street/city/state/zip. Expected format: "Street, City, ST ZIP".`,
          httpStatus: 400,
        }
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
          requested_by: requestedBy,
          summary: { error: message },
          raw_response: errBody,
        })
        return { ok: false, status: 'error', error: message, httpStatus: res.status }
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
        requested_by: requestedBy,
        summary,
        raw_response: data,
        cost_cents: costCents,
      })

      return { ok: true, status, summary, httpStatus: 200 }
    }

    if (action === 'property_lookup') {
      const res = await rentcastFetch('/properties', { address: lead.property_address })
      if (res.status === 404) {
        await supabase.from('lead_enrichments').insert({
          lead_id: leadId,
          type: 'property_lookup',
          provider: 'rentcast',
          status: 'no_match',
          requested_by: requestedBy,
        })
        return { ok: true, status: 'no_match', httpStatus: 200 }
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
          requested_by: requestedBy,
          raw_response: data,
        })
        return { ok: true, status: 'no_match', httpStatus: 200 }
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
        requested_by: requestedBy,
        summary,
        raw_response: record,
      })

      return { ok: true, status: 'success', summary, httpStatus: 200 }
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
        requested_by: requestedBy,
      })
      if (status === 'no_match') return { ok: true, status: 'no_match', httpStatus: 200 }
      throw new Error(`RentCast error ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    // Field names below are verified against a live response (see
    // lead-enrichment history) — raw_response is always stored too, so
    // nothing is lost if a field name ever changes.
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
      requested_by: requestedBy,
      summary,
      raw_response: data,
    })

    return { ok: true, status: 'success', summary, httpStatus: 200 }
  } catch (err) {
    console.error(`enrichment: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    await supabase.from('lead_enrichments').insert({
      lead_id: leadId,
      type: action,
      provider: action === 'skip_trace' ? 'tracerfy' : 'rentcast',
      status: 'error',
      requested_by: requestedBy,
      summary: { error: err instanceof Error ? err.message : String(err) },
    })
    return { ok: false, status: 'error', error: 'Lookup failed', httpStatus: 500 }
  }
}
