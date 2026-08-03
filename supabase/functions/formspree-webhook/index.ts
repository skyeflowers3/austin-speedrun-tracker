// Formspree → Supabase ingest
// Deploy: supabase functions deploy formspree-webhook --no-verify-jwt
// Formspree: Settings → Integrations → Webhook → this function URL
//
// Expected JSON body fields (from austin-speedrun parents.js):
//   name, email, zip, grade, referral_code

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateReferralCode(parentName: string): string {
  const base = parentName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'KID'
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 3).toUpperCase()
  return `${base}${suffix}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const secret = Deno.env.get('FORMSPREE_WEBHOOK_SECRET')
    if (secret) {
      const got = req.headers.get('x-formspree-secret') || new URL(req.url).searchParams.get('secret')
      if (got !== secret) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }

    const body = await req.json()
    const parentName = String(body.name || body.parent_name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const zip = String(body.zip || '').trim()
    const grade = String(body.grade || '').trim()
    const referralCodeFromLink = String(body.referral_code || '').trim().toUpperCase() || null

    if (!parentName || !email || !zip || !grade) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: existing } = await supabase
      .from('participants')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ ok: true, id: existing.id, deduped: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    let referredById: string | null = null
    if (referralCodeFromLink) {
      const { data: referrer } = await supabase
        .from('participants')
        .select('id')
        .eq('referral_code', referralCodeFromLink)
        .maybeSingle()
      referredById = referrer?.id ?? null
    }

    let code = generateReferralCode(parentName)
    let created: { id: string } | null = null
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from('participants')
        .insert({
          parent_name: parentName,
          email,
          zip,
          grade,
          referral_code: code,
          referred_by_id: referredById,
          status: 'waitlisted',
        })
        .select('id')
        .single()
      if (!error && data) {
        created = data
        break
      }
      code = generateReferralCode(parentName)
    }

    if (!created) {
      return new Response(JSON.stringify({ error: 'insert failed' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (referredById) {
      await supabase.from('referrals').insert({
        referrer_id: referredById,
        referred_id: created.id,
        referred_name: parentName,
        referred_email: email,
        status: 'waitlisted',
        submission_method: 'link',
      })
    }

    return new Response(JSON.stringify({ ok: true, id: created.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
