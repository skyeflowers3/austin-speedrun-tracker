# Austin Speedrun Tracker

Ops tracker for Austin Speedrun waitlist / signup referrals.

- **Participants** list (all waitlist + signup rows)
- **Participant detail**: kids, referral code, share link (`signup.html?ref=CODE#join`), who referred them, people they referred, status edits, Add a referral, Edit, Delete
- Works on **local mock data** out of the box; point at **Supabase** when `.env` is set

Marketing site lives in [`austin-speedrun`](../austin-speedrun).

## Run locally

```bash
npm install
cp .env.example .env   # then paste Supabase URL + anon key
npm run dev
```

Open the printed localhost URL. Without `.env`, the app uses mock data.

## Deploy (S3)

Staging: [austin-speedrun-tracker-site](http://austin-speedrun-tracker-site.s3-website-us-east-1.amazonaws.com/)

```bash
# Needs AWS credentials + .env (VITE_SUPABASE_*, VITE_PUBLIC_SITE_URL → marketing staging)
./deploy.sh
```

## Secrets (do not commit)

| File | Commit? |
| --- | --- |
| `.env` | **No** — already in `.gitignore` |
| `.env.example` | Yes — placeholders only |
| `../austin-speedrun/assets/supabase-config.js` | **No** — gitignored on the marketing repo |
| `../austin-speedrun/assets/supabase-config.example.js` | Yes — placeholders only |

Before you commit, run `git status` and confirm `.env` / `supabase-config.js` are **not** listed. If either is staged, unstage it.

## Before you leave (internship handoff)

- [x] Create Supabase project under the **GT org**
- [ ] Add at least one other person as **owner/admin**
- [x] Run SQL (see below)
- [x] Tracker `.env` + marketing `supabase-config.js` with the same project keys
- [x] Confirm Tracker shows “connected to Supabase”
- [ ] Push this repo to a GT-accessible GitHub remote if it is not already
- [ ] **At Tracker deploy:** set `VITE_PUBLIC_SITE_URL` to the live marketing URL (staging S3 now; later `https://speedrun.gt.school`), then `./deploy.sh`. Vite bakes env at build time — if you skip it, share links stay wrong. Staging host: `http://austin-speedrun-tracker-site.s3-website-us-east-1.amazonaws.com/`

## Supabase SQL

In the SQL Editor, run in order (same project):

1. [`supabase/schema.sql`](supabase/schema.sql) — base tables + RPCs  
2. [`supabase/patch-waitlisted-status.sql`](supabase/patch-waitlisted-status.sql) — if needed for `waitlisted` status  
3. [`supabase/patch-waitlist-and-register.sql`](supabase/patch-waitlist-and-register.sql) — waitlist / register RPCs  
4. [`supabase/patch-signup-children.sql`](supabase/patch-signup-children.sql) — `children` table + current `register_participant` (parent first/last + kids jsonb)
5. [`supabase/patch-register-full.sql`](supabase/patch-register-full.sql) — full registration fields used by `signup.html#join`
6. [`supabase/patch-portal-auth.sql`](supabase/patch-portal-auth.sql) — parent portal (`get_my_household` / Auth link) for [`austin-speedrun-portal`](../austin-speedrun-portal)
7. [`supabase/patch-zip-signup-count.sql`](supabase/patch-zip-signup-count.sql) — public `zip_signup_count(zip)` for “X signed up in your zip” UI
8. [`supabase/patch-add-my-child.sql`](supabase/patch-add-my-child.sql) — portal `add_my_child` for parents adding kids after signup
9. [`supabase/patch-household-referral-count.sql`](supabase/patch-household-referral-count.sql) — `get_my_household` includes `referral_count`

Optional: [`supabase/seed.sql`](supabase/seed.sql) for demo rows.

Parent portal: **Create password** / **Sign in** via `set-portal-password` (registered emails only, no auth email). Resend `send-portal-setup-link` is parked until a sending domain is ready. See [`austin-speedrun-portal`](../austin-speedrun-portal).

## How data gets in

| Surface | RPC | Status | Referrals? |
| --- | --- | --- | --- |
| Registration — `signup.html#join` | `register_participant` | `registered` | Yes (`?ref=` or optional code field) |

Same email on re-register updates the household. Invite links:

```
{VITE_PUBLIC_SITE_URL}/signup.html?ref=CODE#join
```

Run [`supabase/patch-register-full.sql`](supabase/patch-register-full.sql) for the full registration field set.

- **Local:** `http://127.0.0.1:8000`
- **Current staging:** `http://austin-speedrun-site.s3-website-us-east-1.amazonaws.com`
- **Planned production:** `https://speedrun.gt.school`

## Wire both apps to the same project

1. Tracker: `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (+ optional `VITE_PUBLIC_SITE_URL`)
2. Marketing: copy `assets/supabase-config.example.js` → `assets/supabase-config.js` with the same URL + anon key
3. Serve marketing (`python3 -m http.server 8000` from `austin-speedrun`), run Tracker (`npm run dev`)
4. Register on `signup.html#join` → refresh Participants
