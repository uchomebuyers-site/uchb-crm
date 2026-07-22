import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type NotifyType = 'hot' | 'under_contract'

const CRM_URL = 'https://crm.uchomebuyers.com'

const MESSAGES: Record<NotifyType, (name: string, address: string) => string> = {
  hot: (name, address) => `🔥 ${name} — ${address} just turned Hot`,
  under_contract: (name, address) => `${name} — ${address} is now Under Contract`,
}

const SUBJECTS: Record<NotifyType, string> = {
  hot: 'Hot lead alert',
  under_contract: 'Lead is Under Contract',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId, type } = await req.json()

    if (!leadId || !(type in MESSAGES)) {
      return new Response(JSON.stringify({ error: 'Invalid leadId or type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, property_address')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) throw leadError ?? new Error('Lead not found')

    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id, email, email_notifications_enabled')
      .eq('role', 'admin')

    if (adminsError) throw adminsError

    const message = MESSAGES[type as NotifyType](lead.name || 'Unnamed lead', lead.property_address || 'No address')

    const notificationRows = (admins ?? []).map((admin) => ({
      user_id: admin.id,
      type,
      lead_id: leadId,
      body: message,
      read: false,
    }))

    if (notificationRows.length) {
      const { error: insertError } = await supabase.from('notifications').insert(notificationRows)
      if (insertError) throw insertError
    }

    const adminEmails = (admins ?? [])
      .filter((a) => a.email_notifications_enabled)
      .map((a) => a.email)
      .filter(Boolean)

    if (adminEmails.length) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'UCHB CRM <onboarding@resend.dev>',
          to: adminEmails,
          subject: SUBJECTS[type as NotifyType],
          html: `<p>${message}</p><p><a href="${CRM_URL}/#/leads/${lead.id}">View lead in CRM →</a></p>`,
        }),
      })

      if (!resendRes.ok) {
        // In-app notification already succeeded; don't fail the whole call
        // just because email delivery had an issue.
        console.error(`Resend error ${resendRes.status}: ${await resendRes.text()}`)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
