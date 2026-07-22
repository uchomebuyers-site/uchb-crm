import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Meta's currently supported Graph API version — verified against
// developers.facebook.com/docs/graph-api/changelog/versions/ (v25.0 current
// as of Feb 2026). Bump here once Meta advances past it.
const GRAPH_API_VERSION = 'v25.0'
const CRM_URL = 'https://crm.uchomebuyers.com'

type FieldDatum = { name: string; values?: string[] }

type ExtractedLead = {
  name: string
  email: string
  phone: string
  propertyAddress: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function digitsOnly(v: string): string {
  return (v || '').replace(/\D/g, '')
}

function fieldValue(fieldData: FieldDatum[], name: string): string {
  return fieldData.find((f) => f.name === name)?.values?.[0] ?? ''
}

// Meta's pre-fillable standard fields use fixed keys (full_name, email,
// phone_number, street_address). Property address is usually a custom
// question on the lead form, which Meta does not guarantee a fixed key
// for — this falls back to the standard "street_address" field, then to
// any field whose name mentions "address". The raw field_data is always
// logged by the caller so a missed mapping can be diagnosed and fixed.
function extractLeadFields(fieldData: FieldDatum[]): ExtractedLead {
  const fullName =
    fieldValue(fieldData, 'full_name') ||
    [fieldValue(fieldData, 'first_name'), fieldValue(fieldData, 'last_name')].filter(Boolean).join(' ')
  const email = fieldValue(fieldData, 'email')
  const phone = fieldValue(fieldData, 'phone_number')
  const propertyAddress =
    fieldValue(fieldData, 'street_address') || fieldData.find((f) => /address/i.test(f.name))?.values?.[0] || ''

  return {
    name: fullName.trim(),
    email: email.trim(),
    phone: digitsOnly(phone),
    propertyAddress: propertyAddress.trim(),
  }
}

async function fetchLeadFieldData(leadgenId: string, accessToken: string): Promise<FieldDatum[]> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?fields=field_data&access_token=${encodeURIComponent(
    accessToken,
  )}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Graph API error ${res.status} for leadgen_id ${leadgenId}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.field_data ?? []
}

// Mirrors the dedupe check in NewLead.jsx: match on phone (exact) or
// property_address (case-insensitive).
async function findDuplicateLead(
  supabase: SupabaseClient,
  phone: string,
  propertyAddress: string,
): Promise<{ id: string } | null> {
  const [byPhone, byAddress] = await Promise.all([
    phone
      ? supabase.from('leads').select('id').eq('phone', phone).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
    propertyAddress
      ? supabase.from('leads').select('id').ilike('property_address', propertyAddress).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ])

  return byPhone.data?.[0] ?? byAddress.data?.[0] ?? null
}

async function notifyAdmins(
  supabase: SupabaseClient,
  lead: { id: string; name: string | null; phone: string | null; property_address: string | null },
) {
  const { data: admins, error: adminsError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('role', 'admin')
    .eq('status', 'active')

  if (adminsError) {
    console.error(`facebook-webhook: failed to load admins for notification: ${adminsError.message}`)
    return
  }

  const activeAdmins = admins ?? []
  const displayName = lead.name || 'Unnamed lead'
  const displayAddress = lead.property_address || 'No address'
  const body = `New Facebook lead: ${displayName} — ${displayAddress}`

  const notificationRows = activeAdmins.map((admin) => ({
    user_id: admin.id,
    type: 'new_lead',
    lead_id: lead.id,
    body,
    read: false,
  }))

  if (notificationRows.length) {
    const { error: notifError } = await supabase.from('notifications').insert(notificationRows)
    if (notifError) {
      console.error(`facebook-webhook: failed to insert notifications for lead ${lead.id}: ${notifError.message}`)
    }
  }

  const adminEmails = activeAdmins.map((a) => a.email).filter(Boolean)
  if (!adminEmails.length) return

  const html = `
    <p>New Facebook lead just came in — <strong>${displayName}</strong>, ${displayAddress}. Call fast.</p>
    ${lead.phone ? `<p>Phone: ${lead.phone}</p>` : ''}
    <p><a href="${CRM_URL}/#/leads/${lead.id}">View lead in CRM →</a></p>
  `

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'UCHB CRM <onboarding@resend.dev>',
      to: adminEmails,
      subject: 'New Facebook lead just came in',
      html,
    }),
  })

  if (!resendRes.ok) {
    console.error(`facebook-webhook: Resend error ${resendRes.status} for lead ${lead.id}: ${await resendRes.text()}`)
  }
}

async function processLeadgenId(
  supabase: SupabaseClient,
  leadgenId: string,
  pageAccessToken: string,
  facebookSourceId: string,
): Promise<{ status: 'created' | 'duplicate' | 'skipped'; leadId?: string }> {
  const fieldData = await fetchLeadFieldData(leadgenId, pageAccessToken)
  const { name, email, phone, propertyAddress } = extractLeadFields(fieldData)

  if (!name || !phone || !propertyAddress) {
    // name/phone/property_address are NOT NULL on leads — inserting without
    // all three would just fail. Log the raw field_data so the mapping can
    // be fixed once we see what this form's questions actually look like,
    // rather than silently losing the lead.
    console.error(
      `facebook-webhook: leadgen_id ${leadgenId} missing a required field after mapping ` +
        `(name="${name}", phone="${phone}", propertyAddress="${propertyAddress}"). ` +
        `Raw field_data: ${JSON.stringify(fieldData)}`,
    )
    return { status: 'skipped' }
  }

  const duplicate = await findDuplicateLead(supabase, phone, propertyAddress)

  if (duplicate) {
    const { error: activityError } = await supabase.from('lead_activity').insert({
      lead_id: duplicate.id,
      author_id: null,
      type: 'note',
      body: `Duplicate Facebook lead received (leadgen_id ${leadgenId}).`,
    })
    if (activityError) {
      console.error(
        `facebook-webhook: failed to log duplicate note for lead ${duplicate.id} (leadgen_id ${leadgenId}): ${activityError.message}`,
      )
    }
    return { status: 'duplicate', leadId: duplicate.id }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('leads')
    .insert({
      name,
      phone,
      property_address: propertyAddress,
      email: email || null,
      source: facebookSourceId,
    })
    .select('id, name, phone, property_address')
    .single()

  if (insertError || !inserted) {
    throw new Error(`Failed to insert lead for leadgen_id ${leadgenId}: ${insertError?.message}`)
  }

  await notifyAdmins(supabase, inserted)

  return { status: 'created', leadId: inserted.id }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // --- Meta's one-time webhook verification handshake ---
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const expectedToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') ?? ''

    if (mode === 'subscribe' && token && expectedToken && timingSafeEqual(token, expectedToken)) {
      return new Response(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    console.error(`facebook-webhook: verification failed (mode=${mode})`)
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // --- Signature verification, before anything else touches the payload ---
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('X-Hub-Signature-256') ?? ''
  const appSecret = Deno.env.get('META_APP_SECRET') ?? ''

  if (!appSecret) {
    console.error('facebook-webhook: META_APP_SECRET is not configured')
    return new Response('Forbidden', { status: 403 })
  }

  const expectedSignature = `sha256=${await hmacSha256Hex(appSecret, rawBody)}`

  if (!signatureHeader || !timingSafeEqual(signatureHeader, expectedSignature)) {
    console.error('facebook-webhook: signature verification failed')
    return new Response('Forbidden', { status: 403 })
  }

  // From here on, always respond 200 — Meta retries (and eventually
  // disables) a webhook that doesn't respond fast/successfully. Any
  // downstream failure is caught and logged instead of surfaced as a
  // non-200, so a Resend hiccup (for example) never causes Meta to see a
  // failure and back off delivery.
  try {
    const payload = JSON.parse(rawBody)
    const leadgenIds: string[] = []

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen' && change.value?.leadgen_id) {
          leadgenIds.push(String(change.value.leadgen_id))
        }
      }
    }

    if (!leadgenIds.length) {
      console.error(`facebook-webhook: no leadgen_id found in payload: ${rawBody}`)
      return json({ ok: true })
    }

    const pageAccessToken = Deno.env.get('META_PAGE_ACCESS_TOKEN') ?? ''
    if (!pageAccessToken) {
      console.error('facebook-webhook: META_PAGE_ACCESS_TOKEN is not configured; cannot fetch lead data')
      return json({ ok: true })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('label', 'Facebook ad')
      .single()

    if (sourceError || !source) {
      console.error(`facebook-webhook: could not find 'Facebook ad' source: ${sourceError?.message ?? 'not found'}`)
      return json({ ok: true })
    }

    for (const leadgenId of leadgenIds) {
      try {
        const result = await processLeadgenId(supabase, leadgenId, pageAccessToken, source.id)
        console.log(`facebook-webhook: processed leadgen_id ${leadgenId} — ${result.status} (lead ${result.leadId ?? 'n/a'})`)
      } catch (err) {
        console.error(
          `facebook-webhook: failed to process leadgen_id ${leadgenId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return json({ ok: true })
  } catch (err) {
    console.error(
      `facebook-webhook: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    )
    return json({ ok: true })
  }
})
