import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Verify who's actually calling by validating their own JWT — never
    // trust a role/email the client claims for itself.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !caller) {
      return json({ error: 'Not authenticated' }, 401)
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', caller.id)
      .single()

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.role !== 'admin' ||
      callerProfile.status !== 'active'
    ) {
      return json({ error: 'Only active admins can invite users' }, 403)
    }

    const { email, role } = await req.json()

    if (!email || typeof email !== 'string') {
      return json({ error: 'A valid email is required' }, 400)
    }

    // Only 'admin' has any RLS-driven meaning right now (is_admin() checks
    // exactly this). Anything else is left as 'pending', which is already
    // the trigger's default — so no follow-up update is needed for it.
    const targetRole = role === 'admin' ? 'admin' : 'pending'

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email)

    if (inviteError || !invited?.user) {
      return json({ error: inviteError?.message ?? 'Failed to send invite' }, 500)
    }

    if (targetRole === 'admin') {
      const { error: roleUpdateError } = await adminClient
        .from('profiles')
        .update({ role: targetRole })
        .eq('id', invited.user.id)

      if (roleUpdateError) {
        return json({ error: `Invite sent, but failed to set role: ${roleUpdateError.message}` }, 500)
      }
    }

    return json({ ok: true, userId: invited.user.id })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
