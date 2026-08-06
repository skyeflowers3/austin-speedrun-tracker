-- Portal: authenticated parent adds a child to their household.
-- Run after patch-portal-auth.sql.

create or replace function public.add_my_child(
  p_full_name text,
  p_grade text,
  p_date_of_birth date,
  p_school_name text,
  p_school_type text,
  p_student_email text default null,
  p_accommodations text default null,
  p_has_home_device boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_full_name, ''));
  v_grade text := trim(coalesce(p_grade, ''));
  v_school text := trim(coalesce(p_school_name, ''));
  v_stype text := trim(coalesce(p_school_type, ''));
  v_email text := nullif(lower(trim(coalesce(p_student_email, ''))), '');
  v_accom text := nullif(trim(coalesce(p_accommodations, '')), '');
  v_age int;
  v_coppa boolean := false;
  v_child_id uuid;
  v_count int;
begin
  v_id := public.link_my_household();

  if v_name = '' or v_grade = '' or v_school = '' or v_stype = '' or p_date_of_birth is null then
    raise exception 'full_name, date_of_birth, grade, school_name, and school_type are required';
  end if;

  v_age := date_part('year', age(current_date, p_date_of_birth))::int;
  if v_age < 13 then
    v_coppa := true;
  end if;

  insert into public.children (
    participant_id, first_name, grade, date_of_birth, school_name, school_type,
    student_email, accommodations, has_home_device
  ) values (
    v_id, v_name, v_grade, p_date_of_birth, v_school, v_stype,
    v_email, v_accom, coalesce(p_has_home_device, false)
  )
  returning id into v_child_id;

  select count(*)::int into v_count
  from public.children
  where participant_id = v_id;

  update public.participants
  set
    grade = case when v_count > 1 then 'Multiple kids' else v_grade end,
    coppa_required = (coalesce(coppa_required, false) or v_coppa),
    updated_at = now()
  where id = v_id;

  return json_build_object(
    'id', v_child_id,
    'full_name', v_name,
    'grade', v_grade,
    'date_of_birth', p_date_of_birth,
    'school_name', v_school,
    'school_type', v_stype,
    'student_email', v_email,
    'accommodations', v_accom,
    'has_home_device', coalesce(p_has_home_device, false),
    'coppa_required', v_coppa
  );
end;
$$;

grant execute on function public.add_my_child(
  text, text, date, text, text, text, text, boolean
) to authenticated;

comment on function public.add_my_child is
  'Parent portal: add one child to the signed-in household.';
