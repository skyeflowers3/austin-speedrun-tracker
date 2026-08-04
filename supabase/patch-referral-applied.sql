-- Return whether a referral code actually matched + strip ambiguous suffix chars.
-- Run in the Austin Speedrun Supabase SQL Editor after patch-signup-children.sql.

create or replace function public.register_participant(
  p_parent_first_name text,
  p_parent_last_name text,
  p_email text,
  p_zip text,
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
  v_first text := trim(p_parent_first_name);
  v_last text := trim(p_parent_last_name);
  v_name text;
  v_zip text := trim(p_zip);
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
begin
  v_name := trim(v_first || ' ' || v_last);
  if v_first = '' or v_last = '' or v_email = '' or v_zip !~ '^\d{5}$' then
    raise exception 'invalid signup fields';
  end if;

  if p_children is null or jsonb_typeof(p_children) <> 'array' or jsonb_array_length(p_children) < 1 then
    raise exception 'at least one child is required';
  end if;

  v_child_count := jsonb_array_length(p_children);
  for v_child in select * from jsonb_array_elements(p_children)
  loop
    if coalesce(trim(v_child->>'first_name'), '') = '' or coalesce(trim(v_child->>'grade'), '') = '' then
      raise exception 'each child needs first_name and grade';
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
    v_id := v_existing.id;
    v_code := v_existing.referral_code;

    update public.participants
    set
      parent_name = v_name,
      zip = v_zip,
      grade = v_grade,
      status = 'registered',
      referred_by_id = coalesce(v_existing.referred_by_id, v_referrer_id),
      updated_at = now()
    where id = v_id;

    v_upgraded := (v_existing.status = 'waitlisted');

    if v_existing.referred_by_id is null and v_referrer_id is not null then
      insert into public.referrals (
        referrer_id, referred_id, referred_name, referred_email, status, submission_method
      ) values (
        v_referrer_id, v_id, v_name, v_email, 'registered', v_method
      );
    end if;

    delete from public.children where participant_id = v_id;
    insert into public.children (participant_id, first_name, grade)
    select v_id, trim(c->>'first_name'), trim(c->>'grade')
    from jsonb_array_elements(p_children) as c;

    return json_build_object(
      'id', v_id,
      'referral_code', v_code,
      'status', 'registered',
      'deduped', not v_upgraded,
      'upgraded', v_upgraded,
      'child_count', v_child_count,
      'referral_applied', (
        v_referrer_id is not null
        and coalesce(v_existing.referred_by_id, v_referrer_id) = v_referrer_id
      )
    );
  end if;

  -- Suffix from hex with ambiguous 0/1/8/B stripped (B vs 8 mix-ups are common)
  v_code := upper(substr(regexp_replace(v_name, '[^A-Za-z]', '', 'g') || 'KID', 1, 4))
            || upper(substr(translate(replace(gen_random_uuid()::text, '-', ''), '018b', ''), 1, 3));

  insert into public.participants (
    parent_name, email, zip, grade, referral_code, referred_by_id, status
  ) values (
    v_name, v_email, v_zip, v_grade, v_code, v_referrer_id, 'registered'
  )
  returning id into v_id;

  insert into public.children (participant_id, first_name, grade)
  select v_id, trim(c->>'first_name'), trim(c->>'grade')
  from jsonb_array_elements(p_children) as c;

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
    'upgraded', false,
    'child_count', v_child_count,
    'referral_applied', v_referrer_id is not null
  );
end;
$$;

grant execute on function public.register_participant(text, text, text, text, jsonb, text) to anon, authenticated;
