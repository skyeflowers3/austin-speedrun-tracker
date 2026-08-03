-- Re-apply waitlist status on the public waitlist RPC + defaults.
-- Paste into Supabase SQL Editor and Run.

alter table public.participants
  alter column status set default 'waitlisted';

alter table public.referrals
  alter column status set default 'waitlisted';

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
begin
  if v_name = '' or v_email = '' or v_zip !~ '^\d{5}$' or v_grade = '' then
    raise exception 'invalid signup fields';
  end if;

  select * into v_existing
  from public.participants
  where lower(email) = v_email
  limit 1;

  if found then
    return json_build_object(
      'id', v_existing.id,
      'referral_code', v_existing.referral_code,
      'deduped', true
    );
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

  v_code := upper(substr(regexp_replace(v_name, '[^A-Za-z]', '', 'g') || 'KID', 1, 4))
            || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3);
  v_code := upper(v_code);

  insert into public.participants (
    parent_name, email, zip, grade, referral_code, referred_by_id, status
  ) values (
    v_name, v_email, v_zip, v_grade, v_code, v_referrer_id, 'waitlisted'
  )
  returning id into v_id;

  if v_referrer_id is not null then
    insert into public.referrals (
      referrer_id, referred_id, referred_name, referred_email, status, submission_method
    ) values (
      v_referrer_id, v_id, v_name, v_email, 'waitlisted', v_method
    );
  end if;

  return json_build_object(
    'id', v_id,
    'referral_code', v_code,
    'deduped', false
  );
end;
$$;

-- Optional: flip existing test rows from registered → waitlisted
update public.participants set status = 'waitlisted' where status = 'registered';
update public.referrals set status = 'waitlisted' where status = 'registered';
