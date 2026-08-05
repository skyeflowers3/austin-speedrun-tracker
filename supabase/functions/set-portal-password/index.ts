// Set / reset a parent portal password for an existing registration.
// No email sent — client signs in with the password afterward.
//
// Deploy: supabase functions deploy set-portal-password --no-verify-jwt
// Body: { email, password }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email.includes('@')) return json({ error: 'invalid email' }, 400)
    if (password.length < 8) return json({ error: 'password too short' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: participant, error: pErr } = await supabase
      .from('participants')
      .select('id, email, auth_user_id')
      .ilike('email', email)
      .maybeSingle()

    if (pErr) return json({ error: pErr.message }, 500)
    if (!participant) {
      return json({ error: 'no registration found for this email' }, 404)
    }

    let userId: string | null = participant.auth_user_id || null

    // Auth user may have been deleted while participants still pointed at it.
    if (userId) {
      const { data: existing } = await supabase.auth.admin.getUserById(userId)
      if (!existing?.user) {
        userId = null
        await supabase
          .from('participants')
          .update({ auth_user_id: null, updated_at: new Date().toISOString() })
          .eq('id', participant.id)
      }
    }

    if (!userId) {
      const lookup = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        },
      )
      if (lookup.ok) {
        const payload = await lookup.json()
        const users = payload?.users || payload || []
        const found = Array.isArray(users)
          ? users.find((u: { email?: string }) => (u.email || '').toLowerCase() === email)
          : null
        userId = found?.id ?? null
      }
    }

    if (userId) {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      })
      if (error) return json({ error: error.message }, 500)
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) return json({ error: error.message }, 500)
      userId = data.user?.id ?? null
    }

    if (userId) {
      const { error: attachErr } = await supabase
        .from('participants')
        .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', participant.id)
      if (attachErr) return json({ error: attachErr.message }, 500)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
