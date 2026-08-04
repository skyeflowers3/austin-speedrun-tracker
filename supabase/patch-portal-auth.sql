-- Parent portal auth: link auth.users → participants, household RPC.
-- Run in Supabase SQL Editor after patch-register-full.sql.
-- Portal app calls get_my_household() while logged in (magic link / OTP).

alter table public.participants
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists participants_auth_user_id_idx
  on public.participants (auth_user_id);

-- Attach the signed-in Auth user to the participant row with the same email.
create or replace function public.link_my_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_id uuid;
begin
  if v_uid is null or v_email = '' then
    raise exception 'not authenticated';
  end if;

  select id into v_id
  from public.participants
  where auth_user_id = v_uid
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  update public.participants
  set auth_user_id = v_uid, updated_at = now()
  where lower(email) = v_email
    and (auth_user_id is null or auth_user_id = v_uid)
  returning id into v_id;

  if v_id is null then
    raise exception 'no registration found for this email';
  end if;

  return v_id;
end;
$$;

-- Parent dashboard payload: household + kids + referral code.
create or replace function public.get_my_household()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.participants%rowtype;
begin
  v_id := public.link_my_household();

  select * into v_row from public.participants where id = v_id;

  return json_build_object(
    'id', v_row.id,
    'parent_name', v_row.parent_name,
    'email', v_row.email,
    'zip', v_row.zip,
    'status', v_row.status,
    'referral_code', v_row.referral_code,
    'coppa_required', coalesce(v_row.coppa_required, false),
    'children', coalesce(
      (
        select json_agg(
          json_build_object(
            'id', c.id,
            'full_name', coalesce(nullif(trim(c.first_name), ''), 'Child'),
            'grade', c.grade,
            'date_of_birth', c.date_of_birth,
            'school_name', c.school_name,
            'school_type', c.school_type,
            'student_email', c.student_email,
            'accommodations', c.accommodations,
            'has_home_device', c.has_home_device
          )
          order by c.first_name
        )
        from public.children c
        where c.participant_id = v_id
      ),
      '[]'::json
    )
  );
end;
$$;

grant execute on function public.link_my_household() to authenticated;
grant execute on function public.get_my_household() to authenticated;

-- Note: existing open anon policies on participants/children remain for the
-- staff Tracker. Tighten those before public launch; portal parents should
-- use get_my_household() only.
