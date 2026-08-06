-- Referral counts for the parent portal invite card:
--   referral_count       — season total
--   referral_count_month — current calendar month (raffle window)

create or replace function public.get_my_household()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.participants%rowtype;
  v_referral_count int;
  v_referral_count_month int;
begin
  v_id := public.link_my_household();

  select * into v_row from public.participants where id = v_id;

  select count(*)::int into v_referral_count
  from public.referrals
  where referrer_id = v_id;

  select count(*)::int into v_referral_count_month
  from public.referrals
  where referrer_id = v_id
    and created_at >= date_trunc('month', now());

  return json_build_object(
    'id', v_row.id,
    'parent_name', v_row.parent_name,
    'email', v_row.email,
    'zip', v_row.zip,
    'status', v_row.status,
    'referral_code', v_row.referral_code,
    'coppa_required', coalesce(v_row.coppa_required, false),
    'referral_count', coalesce(v_referral_count, 0),
    'referral_count_month', coalesce(v_referral_count_month, 0),
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

grant execute on function public.get_my_household() to authenticated;
