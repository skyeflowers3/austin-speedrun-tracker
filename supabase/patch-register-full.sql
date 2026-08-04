-- Full registration fields for parents.html#join + referrals.
-- Run in the Austin Speedrun Supabase SQL Editor after prior patches.

-- Parent extras
alter table public.participants
  add column if not exists phone text,
  add column if not exists street text,
  add column if not exists unit text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists heard_about text,
  add column if not exists signed_by text,
  add column if not exists coppa_required boolean not null default false;

-- Child extras (legal name stays in first_name for backwards compat)
alter table public.children
  add column if not exists date_of_birth date,
  add column if not exists school_name text,
  add column if not exists school_type text,
  add column if not exists student_email text,
  add column if not exists accommodations text,
  add column if not exists has_home_device boolean;

-- Drop prior register signatures so PostgREST binds the new one
drop function if exists public.register_participant(text, text, text, text, text);
drop function if exists public.register_participant(text, text, text, text, jsonb, text);

create or replace function public.register_participant(
  p_parent_name text,
  p_email text,
  p_phone text,
  p_street text,
  p_unit text,
  p_city text,
  p_state text,
  p_zip text,
  p_heard_about text,
  p_signed_by text,
  p_children jsonb,
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
  v_phone text := trim(coalesce(p_phone, ''));
  v_street text := trim(coalesce(p_street, ''));
  v_unit text := trim(coalesce(p_unit, ''));
  v_city text := trim(coalesce(p_city, ''));
  v_state text := upper(trim(coalesce(p_state, '')));
  v_zip text := trim(p_zip);
  v_heard text := nullif(trim(coalesce(p_heard_about, '')), '');
  v_signed text := trim(coalesce(p_signed_by, ''));
  v_grade text;
  v_ref text := nullif(upper(trim(coalesce(p_referral_code, ''))), '');
  v_referrer_id uuid;
  v_existing public.participants%rowtype;
  v_code text;
  v_id uuid;
  v_method public.submission_method;
  v_upgraded boolean := false;
  v_child_count int;
  v_child jsonb;
  v_coppa boolean := false;
  v_dob date;
  v_age int;
  v_was_existing boolean := false;
begin
  if v_name = '' or v_email = '' or v_phone = '' or v_street = '' or v_city = '' or v_state = '' or v_zip !~ '^\d{5}$' or v_signed = '' then
    raise exception 'invalid registration fields';
  end if;

  if p_children is null or jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) < 1 then
    raise exception 'at least one child is required';
  end if;

  v_child_count := jsonb_array_length(p_children);
  for v_child in select * from jsonb_array_elements(p_children)
  loop
    if coalesce(trim(v_child->>'full_name'), '') = ''
       or coalesce(trim(v_child->>'grade'), '') = ''
       or coalesce(trim(v_child->>'school_name'), '') = ''
       or coalesce(trim(v_child->>'school_type'), '') = ''
       or coalesce(trim(v_child->>'date_of_birth'), '') = '' then
      raise exception 'each child needs full_name, date_of_birth, grade, school_name, school_type';
    end if;
    begin
      v_dob := (trim(v_child->>'date_of_birth'))::date;
    exception when others then
      raise exception 'invalid child date_of_birth';
    end;
    v_age := date_part('year', age(current_date, v_dob))::int;
    if v_age < 13 then
      v_coppa := true;
    end if;
  end loop;

  if v_child_count = 1 then
    v_grade := trim(p_children->0->>'grade');
  else
    v_grade := 'Multiple kids';
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
    v_was_existing := true;
    v_id := v_existing.id;
    v_code := v_existing.referral_code;
    v_upgraded := (v_existing.status = 'waitlisted');

    update public.participants
    set
      parent_name = v_name,
      phone = v_phone,
      street = v_street,
      unit = nullif(v_unit, ''),
      city = v_city,
      state = v_state,
      zip = v_zip,
      grade = v_grade,
      heard_about = v_heard,
      signed_by = v_signed,
      coppa_required = v_coppa,
      status = 'registered',
      referred_by_id = coalesce(v_existing.referred_by_id, v_referrer_id),
      updated_at = now()
    where id = v_id;

    if v_existing.referred_by_id is null and v_referrer_id is not null then
      insert into public.referrals (
        referrer_id, referred_id, referred_name, referred_email, status, submission_method
      ) values (
        v_referrer_id, v_id, v_name, v_email, 'registered', v_method
      );
    end if;

    delete from public.children where participant_id = v_id;
  else
    v_code := upper(substr(regexp_replace(v_name, '[^A-Za-z]', '', 'g') || 'KID', 1, 4))
              || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3);
    v_code := upper(v_code);

    insert into public.participants (
      parent_name, email, phone, street, unit, city, state, zip, grade,
      referral_code, referred_by_id, status, heard_about, signed_by, coppa_required
    ) values (
      v_name, v_email, v_phone, v_street, nullif(v_unit, ''), v_city, v_state, v_zip, v_grade,
      v_code, v_referrer_id, 'registered', v_heard, v_signed, v_coppa
    )
    returning id into v_id;

    if v_referrer_id is not null then
      insert into public.referrals (
        referrer_id, referred_id, referred_name, referred_email, status, submission_method
      ) values (
        v_referrer_id, v_id, v_name, v_email, 'registered', v_method
      );
    end if;
  end if;

  insert into public.children (
    participant_id, first_name, grade, date_of_birth, school_name, school_type,
    student_email, accommodations, has_home_device
  )
  select
    v_id,
    trim(c->>'full_name'),
    trim(c->>'grade'),
    (trim(c->>'date_of_birth'))::date,
    trim(c->>'school_name'),
    trim(c->>'school_type'),
    nullif(lower(trim(coalesce(c->>'student_email', ''))), ''),
    nullif(trim(coalesce(c->>'accommodations', '')), ''),
    coalesce((c->>'has_home_device')::boolean, false)
  from jsonb_array_elements(p_children) as c;

  return json_build_object(
    'id', v_id,
    'referral_code', v_code,
    'status', 'registered',
    'deduped', v_was_existing and not v_upgraded,
    'upgraded', v_upgraded,
    'child_count', v_child_count,
    'coppa_required', v_coppa
  );
end;
$$;

grant execute on function public.register_participant(
  text, text, text, text, text, text, text, text, text, text, jsonb, text
) to anon, authenticated;
