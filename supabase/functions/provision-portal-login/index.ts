// After Speedrun registration: create/reset Auth password + email portal credentials.
// Deploy:
//   supabase functions deploy provision-portal-login --no-verify-jwt
// Secrets (optional email):
//   supabase secrets set RESEND_API_KEY=re_... PORTAL_FROM_EMAIL="Austin Speedrun <onboarding@resend.dev>"
//
// Body: { email, portal_url? }
// Returns: { ok, password, portal_url, emailed, parent_name }

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

function randomPassword(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const portalUrl = String(body.portal_url || Deno.env.get('PORTAL_URL') || '')
      .trim()
      .replace(/\/$/, '')

    if (!email.includes('@')) return json({ error: 'invalid email' }, 400)
    if (!portalUrl) return json({ error: 'portal_url required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: participant, error: pErr } = await supabase
      .from('participants')
      .select('id, parent_name, email, auth_user_id')
      .ilike('email', email)
      .maybeSingle()

    if (pErr) return json({ error: pErr.message }, 500)
    if (!participant) {
      return json({ error: 'no registration found for this email' }, 404)
    }

    const password = randomPassword(12)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    let userId: string | null = participant.auth_user_id || null
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
        user_metadata: { parent_name: participant.parent_name },
      })
      if (error) return json({ error: error.message }, 500)
      userId = data.user?.id ?? null
    }

    if (userId) {
      await supabase
        .from('participants')
        .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', participant.id)
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('PORTAL_FROM_EMAIL') || 'Austin Speedrun <onboarding@resend.dev>'

    if (!resendKey) {
      return json({
        error: 'RESEND_API_KEY not configured — cannot email portal password',
        ok: false,
        emailed: false,
      }, 500)
    }

    const html = `
      <p>Hi ${escapeHtml(participant.parent_name.split(' ')[0] || 'there')},</p>
      <p>Your Austin Speedrun <b>parent portal</b> is ready.</p>
      <p><b>Portal:</b> <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a></p>
      <p><b>Email:</b> ${escapeHtml(email)}<br/>
      <b>Temporary password:</b> <code>${escapeHtml(password)}</code></p>
      <p>Sign in with these, then change your password anytime in the portal.</p>
    `
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your Austin Speedrun parent portal login',
        html,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('Resend failed', detail)
      return json({ ok: false, emailed: false, error: 'email send failed' }, 502)
    }

    // Never return the password to the browser — email only.
    return json({
      ok: true,
      emailed: true,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
