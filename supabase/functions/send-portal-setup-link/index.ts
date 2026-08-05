// PARKED (enable when a real sending domain is verified in Resend).
// Until then the portal uses Create password via set-portal-password (no email).
//
// After Speedrun registration: ensure Auth user exists, email a one-time
// set-password link via Resend (no plaintext password in the email).
//
// Deploy:
//   supabase functions deploy send-portal-setup-link --no-verify-jwt
// Secrets:
//   supabase secrets set RESEND_API_KEY=re_... \
//     PORTAL_FROM_EMAIL="Austin Speedrun <login@yourdomain.com>" \
//     PORTAL_URL="https://your-portal.example"
//
// Body: { email, portal_url? }
// Returns: { ok, emailed } — only if email is already in participants.

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

function randomPassword(len = 24) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: participant, error: pErr } = await supabase
      .from('participants')
      .select('id, parent_name, email, auth_user_id')
      .ilike('email', email)
      .maybeSingle()

    if (pErr) return json({ error: pErr.message }, 500)
    if (!participant) {
      // Don't leak whether an email exists to casual callers — same shape either way
      // after send, but registration path already knows they exist.
      return json({ error: 'no registration found for this email' }, 404)
    }

    let userId: string | null = participant.auth_user_id || null

    // If Auth user was deleted, drop the stale FK before creating a new one.
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

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          parent_name: participant.parent_name,
          password_set: false,
        },
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

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${portalUrl}/` },
    })
    if (linkErr) return json({ error: linkErr.message }, 500)

    const actionLink = linkData?.properties?.action_link
    if (!actionLink) return json({ error: 'failed to generate set-password link' }, 500)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('PORTAL_FROM_EMAIL') || 'Austin Speedrun <onboarding@resend.dev>'

    if (!resendKey) {
      return json({
        error: 'RESEND_API_KEY not configured — cannot email set-password link',
        ok: false,
        emailed: false,
      }, 500)
    }

    const first = (participant.parent_name || '').split(' ')[0] || 'there'
    const html = `
      <p>Hi ${escapeHtml(first)},</p>
      <p>Thanks for registering for the Austin Speedrun. Set a password for your <b>parent portal</b> here:</p>
      <p><a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:12px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Set your password</a></p>
      <p>Or open this link:<br/><a href="${escapeHtml(actionLink)}">${escapeHtml(actionLink)}</a></p>
      <p>After you set it, sign in anytime at <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a> with this email.</p>
      <p>If you didn’t register, you can ignore this email.</p>
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
        subject: 'Set your Austin Speedrun parent portal password',
        html,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('Resend failed', detail)
      return json({ ok: false, emailed: false, error: 'email send failed' }, 502)
    }

    return json({ ok: true, emailed: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
