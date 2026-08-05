-- Public per-zip signup count for marketing UI ("X already signed up in your zip").
-- Safe: returns only a number, not row data. Run in Supabase SQL Editor.
--
-- Usage (anon / browser):
--   supabase.rpc('zip_signup_count', { p_zip: '78701' })

create or replace function public.zip_signup_count(p_zip text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.participants
  where zip = trim(p_zip)
    and status is distinct from 'declined';
$$;

grant execute on function public.zip_signup_count(text) to anon, authenticated;

comment on function public.zip_signup_count(text) is
  'Returns how many non-declined participants are registered for a ZIP. Public-safe aggregate for marketing.';
