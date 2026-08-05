-- Austin Speedrun Tracker — system of record
-- Run in Supabase SQL Editor (org-owned project). Then optionally run seed.sql.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.participant_status as enum (
    'waitlisted',
    'registered',
    'enrolled',
    'declined'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.submission_method as enum (
    'link',
    'direct_submit',
    'staff_attributed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  email text not null,
  zip text not null check (zip ~ '^\d{5}$'),
  grade text not null,
  referral_code text not null unique,
  referred_by_id uuid references public.participants (id),
  status public.participant_status not null default 'waitlisted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists participants_email_lower_idx
  on public.participants (lower(email));

create index if not exists participants_zip_idx on public.participants (zip);
create index if not exists participants_status_idx on public.participants (status);
create index if not exists participants_referred_by_id_idx on public.participants (referred_by_id);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.participants (id) on delete cascade,
  referred_id uuid references public.participants (id) on delete set null,
  referred_name text not null,
  referred_email text not null,
  status public.participant_status not null default 'waitlisted',
  submission_method public.submission_method not null default 'link',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);
create index if not exists referrals_referred_id_idx on public.referrals (referred_id);
create index if not exists referrals_status_idx on public.referrals (status);

-- Public read of code → first name for marketing "Referred by …"
-- security_invoker: respects RLS on participants (do not use SECURITY DEFINER)
create or replace view public.referral_code_public
  with (security_invoker = on)
as
select
  referral_code,
  split_part(parent_name, ' ', 1) as display_name
from public.participants;

alter table public.participants enable row level security;
alter table public.referrals enable row level security;

-- Practice policies: open for Tracker + signup. Tighten before public launch.
drop policy if exists "participants_all_anon" on public.participants;
create policy "participants_all_anon"
  on public.participants for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "referrals_all_anon" on public.referrals;
create policy "referrals_all_anon"
  on public.referrals for all to anon, authenticated
  using (true) with check (true);

grant select on public.referral_code_public to anon, authenticated;

-- Waitlist + register RPCs (also in patch-waitlist-and-register.sql)
-- 1) Waitlist: status waitlisted, ignores referrals
create or replace function public.waitlist_participant(
  p_parent_name text,
  p_email text,
  p_zip text,
  p_grade text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_parent_name);
  v_zip text := trim(p_zip);
  v_grade text := trim(p_grade);
  v_existing public.participants%rowtype;
  v_code text;
  v_id uuid;
begin
  if v_name = '' or v_email = '' or v_zip !~ '^\d{5}$' or v_grade = '' then
    raise exception 'invalid waitlist fields';
  end if;

  select * into v_existing
  from public.participants
  where lower(email) = v_email
  limit 1;

  if found then
    return json_build_object(
      'id', v_existing.id,
      'referral_code', v_existing.referral_code,
      'status', v_existing.status,
      'deduped', true
    );
  end if;

  v_code := upper(substr(regexp_replace(v_name, '[^A-Za-z]', '', 'g') || 'KID', 1, 4))
            || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3);
  v_code := upper(v_code);

  insert into public.participants (
    parent_name, email, zip, grade, referral_code, referred_by_id, status
  ) values (
    v_name, v_email, v_zip, v_grade, v_code, null, 'waitlisted'
  )
  returning id into v_id;

  return json_build_object(
    'id', v_id,
    'referral_code', v_code,
    'status', 'waitlisted',
    'deduped', false
  );
end;
$$;

grant execute on function public.waitlist_participant(text, text, text, text) to anon, authenticated;

-- 2) Signup/register: status registered, applies referral codes
create or replace function public.register_participant(
  p_parent_name text,
  p_email text,
  p_zip text,
  p_grade text,
  p_referral_code text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_parent_name);
  v_zip text := trim(p_zip);
  v_grade text := trim(p_grade);
  v_ref text := nullif(upper(trim(coalesce(p_referral_code, ''))), '');
  v_referrer_id uuid;
  v_existing public.participants%rowtype;
  v_code text;
  v_id uuid;
  v_method public.submission_method;
  v_upgraded boolean := false;
begin
  if v_name = '' or v_email = '' or v_zip !~ '^\d{5}$' or v_grade = '' then
    raise exception 'invalid signup fields';
  end if;

  v_referrer_id := null;
  if v_ref is not null then
    select id into v_referrer_id
    from public.participants
    where referral_code = v_ref
    limit 1;
  end if;

  v_method := case when v_referrer_id is not null then 'link'::public.submission_method
                   else 'direct_submit'::public.submission_method end;

  select * into v_existing
  from public.participants
  where lower(email) = v_email
  limit 1;

  if found then
    v_id := v_existing.id;
    v_code := v_existing.referral_code;

    -- Upgrade waitlisted → registered; refresh profile fields
    if v_existing.status = 'waitlisted' then
      update public.participants
      set
        parent_name = v_name,
        zip = v_zip,
        grade = v_grade,
        status = 'registered',
        referred_by_id = coalesce(v_existing.referred_by_id, v_referrer_id),
        updated_at = now()
      where id = v_id;
      v_upgraded := true;

      if v_existing.referred_by_id is null and v_referrer_id is not null then
        insert into public.referrals (
          referrer_id, referred_id, referred_name, referred_email, status, submission_method
        ) values (
          v_referrer_id, v_id, v_name, v_email, 'registered', v_method
        );
      end if;
    end if;

    return json_build_object(
      'id', v_id,
      'referral_code', v_code,
      'status', 'registered',
      'deduped', not v_upgraded,
      'upgraded', v_upgraded
    );
  end if;

  v_code := upper(substr(regexp_replace(v_name, '[^A-Za-z]', '', 'g') || 'KID', 1, 4))
            || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3);
  v_code := upper(v_code);

  insert into public.participants (
    parent_name, email, zip, grade, referral_code, referred_by_id, status
  ) values (
    v_name, v_email, v_zip, v_grade, v_code, v_referrer_id, 'registered'
  )
  returning id into v_id;

  if v_referrer_id is not null then
    insert into public.referrals (
      referrer_id, referred_id, referred_name, referred_email, status, submission_method
    ) values (
      v_referrer_id, v_id, v_name, v_email, 'registered', v_method
    );
  end if;

  return json_build_object(
    'id', v_id,
    'referral_code', v_code,
    'status', 'registered',
    'deduped', false,
    'upgraded', false
  );
end;
$$;

grant execute on function public.register_participant(text, text, text, text, text) to anon, authenticated;

-- Keep old name as alias for waitlist (back-compat)
create or replace function public.signup_participant(
  p_parent_name text,
  p_email text,
  p_zip text,
  p_grade text,
  p_referral_code text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Waitlist path: ignore referral_code
  return public.waitlist_participant(p_parent_name, p_email, p_zip, p_grade);
end;
$$;
