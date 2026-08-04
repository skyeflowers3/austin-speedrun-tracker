# Austin Speedrun Tracker

Ops tracker for Austin Speedrun waitlist / signup referrals.

- **Participants** list (all waitlist + signup rows)
- **Participant detail**: kids, referral code, share link (`parents.html?ref=CODE#join`), who referred them, people they referred, status edits, Add a referral, Edit, Delete
- Works on **local mock data** out of the box; point at **Supabase** when `.env` is set

Marketing site lives in [`austin-speedrun`](../austin-speedrun).

## Run locally

```bash
npm install
cp .env.example .env   # then paste Supabase URL + anon key
npm run dev
```

Open the printed localhost URL. Without `.env`, the app uses mock data.

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
- [ ] **At Tracker deploy (you own this):** set `VITE_PUBLIC_SITE_URL=https://speedrun.gt.school` (or the real marketing URL), then `npm run build` and redeploy. Vite bakes this at build time — if you skip it, share links stay localhost. Marketing site deploy is separate and does not need this from you.

## Supabase SQL

In the SQL Editor, run in order (same project):

1. [`supabase/schema.sql`](supabase/schema.sql) — base tables + RPCs  
2. [`supabase/patch-waitlisted-status.sql`](supabase/patch-waitlisted-status.sql) — if needed for `waitlisted` status  
3. [`supabase/patch-waitlist-and-register.sql`](supabase/patch-waitlist-and-register.sql) — waitlist / register RPCs  
4. [`supabase/patch-signup-children.sql`](supabase/patch-signup-children.sql) — `children` table + current `register_participant` (parent first/last + kids jsonb)

Optional: [`supabase/seed.sql`](supabase/seed.sql) for demo rows.

## How data gets in

| Surface | RPC | Status | Referrals? |
| --- | --- | --- | --- |
| Registration — `parents.html#join` | `register_participant` | `registered` | Yes (`?ref=` or optional code field) |

Same email on re-register updates the household. Invite links:

```
{VITE_PUBLIC_SITE_URL}/parents.html?ref=CODE#join
```

Run [`supabase/patch-register-full.sql`](supabase/patch-register-full.sql) for the full registration field set.

- **Local:** `http://127.0.0.1:8000` (default / `.env`)
- **Planned production:** `https://speedrun.gt.school`

## Wire both apps to the same project

1. Tracker: `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (+ optional `VITE_PUBLIC_SITE_URL`)
2. Marketing: copy `assets/supabase-config.example.js` → `assets/supabase-config.js` with the same URL + anon key
3. Serve marketing (`python3 -m http.server 8000` from `austin-speedrun`), run Tracker (`npm run dev`)
4. Register on `parents.html#join` → refresh Participants
