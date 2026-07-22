import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SOURCE_LABEL = 'Foreclosure Monitor'
const TAG_LABEL = 'Foreclosure'
const CRM_URL = 'https://crm.uchomebuyers.com'

type IntakePayload = {
  name?: string
  phone?: string
  property_address?: string
  email?: string
  notes?: string
  timeline_to_sell?: string
  motivation?: string
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

// Mirrors the dedupe check in NewLead.jsx / facebook-webhook: match on
// phone (exact) or property_address (case-insensitive).
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
    .select('id, email, email_notifications_enabled')
    .eq('role', 'admin')
    .eq('status', 'active')

  if (adminsError) {
    console.error(`foreclosure-lead-intake: failed to load admins for notification: ${adminsError.message}`)
    return
  }

  const activeAdmins = admins ?? []
  const displayName = lead.name || 'Unnamed lead'
  const displayAddress = lead.property_address || 'No address'
  const body = `New foreclosure lead: ${displayName} — ${displayAddress}`

  // In-app notifications go to every active admin regardless of email
  // preference — muting email doesn't mute the primary in-app channel.
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
      console.error(`foreclosure-lead-intake: failed to insert notifications for lead ${lead.id}: ${notifError.message}`)
    }
  }

  const adminEmails = activeAdmins
    .filter((a) => a.email_notifications_enabled)
    .map((a) => a.email)
    .filter(Boolean)
  if (!adminEmails.length) return

  const html = `
    <p>New foreclosure lead just came in — <strong>${displayName}</strong>, ${displayAddress}.</p>
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
      subject: 'New foreclosure lead just came in',
      html,
    }),
  })

  if (!resendRes.ok) {
    console.error(
      `foreclosure-lead-intake: Resend error ${resendRes.status} for lead ${lead.id}: ${await resendRes.text()}`,
    )
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const expectedToken = Deno.env.get('FORECLOSURE_INTAKE_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!expectedToken || !providedToken || !timingSafeEqual(providedToken, expectedToken)) {
    console.error('foreclosure-lead-intake: unauthorized request')
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: IntakePayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const name = (payload.name ?? '').trim()
  const phone = (payload.phone ?? '').trim()
  const propertyAddress = (payload.property_address ?? '').trim()

  if (!name || !phone || !propertyAddress) {
    return json({ error: 'name, phone, and property_address are required' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  try {
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('label', SOURCE_LABEL)
      .single()

    if (sourceError || !source) {
      console.error(`foreclosure-lead-intake: could not find '${SOURCE_LABEL}' source: ${sourceError?.message ?? 'not found'}`)
      return json({ error: `'${SOURCE_LABEL}' source is not configured` }, 500)
    }

    const duplicate = await findDuplicateLead(supabase, phone, propertyAddress)

    if (duplicate) {
      const { error: activityError } = await supabase.from('lead_activity').insert({
        lead_id: duplicate.id,
        author_id: null,
        type: 'note',
        body: 'Duplicate foreclosure lead received from Hermes.',
      })
      if (activityError) {
        console.error(
          `foreclosure-lead-intake: failed to log duplicate note for lead ${duplicate.id}: ${activityError.message}`,
        )
      }
      return json({ ok: true, status: 'duplicate', leadId: duplicate.id })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('leads')
      .insert({
        name,
        phone,
        property_address: propertyAddress,
        email: payload.email?.trim() || null,
        notes: payload.notes?.trim() || null,
        timeline_to_sell: payload.timeline_to_sell?.trim() || null,
        motivation: payload.motivation?.trim() || null,
        source: source.id,
      })
      .select('id, name, phone, property_address')
      .single()

    if (insertError || !inserted) {
      throw new Error(`Failed to insert lead: ${insertError?.message}`)
    }

    const { data: tag, error: tagError } = await supabase.from('tags').select('id').eq('label', TAG_LABEL).single()
    if (tagError || !tag) {
      console.error(`foreclosure-lead-intake: could not find '${TAG_LABEL}' tag: ${tagError?.message ?? 'not found'}`)
    } else {
      const { error: tagLinkError } = await supabase.from('lead_tags').insert({ lead_id: inserted.id, tag_id: tag.id })
      if (tagLinkError) {
        console.error(`foreclosure-lead-intake: failed to tag lead ${inserted.id}: ${tagLinkError.message}`)
      }
    }

    await notifyAdmins(supabase, inserted)

    return json({ ok: true, status: 'created', leadId: inserted.id })
  } catch (err) {
    console.error(
      `foreclosure-lead-intake: unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    )
    return json({ error: 'Internal error' }, 500)
  }
})
