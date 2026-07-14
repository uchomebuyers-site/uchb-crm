import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Business "today" is the America/Chicago calendar date, not the server's
// UTC date — this function runs at 7am Central, when UTC is already several
// hours into the next day, so a naive UTC date would be wrong.
function centralTodayISODate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function escapeHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const today = centralTodayISODate()

    const [{ data: stages, error: stagesError }, { data: leads, error: leadsError }] = await Promise.all([
      supabase.from('stages').select('id, is_terminal'),
      supabase
        .from('leads')
        .select('id, name, property_address, next_follow_up, stage')
        .lte('next_follow_up', today)
        .order('next_follow_up', { ascending: true }),
    ])

    if (stagesError) throw stagesError
    if (leadsError) throw leadsError

    const terminalIds = new Set((stages ?? []).filter((s) => s.is_terminal).map((s) => s.id))
    const dueLeads = (leads ?? []).filter((l) => l.next_follow_up && !terminalIds.has(l.stage))

    if (dueLeads.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'no leads due today' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')

    if (adminsError) throw adminsError

    const adminEmails = (admins ?? []).map((a) => a.email).filter(Boolean)

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: 'no admin emails on file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const listHtml = dueLeads
      .map(
        (l) =>
          `<li><strong>${escapeHtml(l.name || 'Unnamed lead')}</strong> — ${escapeHtml(
            l.property_address || 'No address',
          )} (due ${fmtDate(l.next_follow_up)})</li>`,
      )
      .join('')

    const html = `
      <p>Good morning — here's who needs you today.</p>
      <ul>${listHtml}</ul>
      <p>— UCHB CRM</p>
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
        subject: `${dueLeads.length} follow-up${dueLeads.length === 1 ? '' : 's'} due today`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const text = await resendRes.text()
      throw new Error(`Resend error ${resendRes.status}: ${text}`)
    }

    return new Response(JSON.stringify({ sent: true, count: dueLeads.length }), {
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
