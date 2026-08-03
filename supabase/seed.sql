-- Demo seed for local/practice. Safe to re-run after truncate.

truncate public.referrals, public.participants restart identity cascade;

insert into public.participants (id, parent_name, email, zip, grade, referral_code, status, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'Maya Chen', 'maya@example.com', '78704', '7th grade', 'MAYA7K', 'enrolled', now() - interval '12 days'),
  ('22222222-2222-2222-2222-222222222222', 'Jordan Lee', 'jordan@example.com', '78745', '6th grade', 'JORD42', 'registered', now() - interval '10 days'),
  ('33333333-3333-3333-3333-333333333333', 'Sam Rivera', 'sam@example.com', '78704', '8th grade', 'SAM9R', 'waitlisted', now() - interval '8 days'),
  ('44444444-4444-4444-4444-444444444444', 'Avery Kim', 'avery@example.com', '78613', '7th grade', 'AVE3X', 'waitlisted', now() - interval '5 days'),
  ('55555555-5555-5555-5555-555555555555', 'Casey Brooks', 'casey@example.com', '78704', '6th grade', 'CAS88', 'waitlisted', now() - interval '3 days'),
  ('66666666-6666-6666-6666-666666666666', 'Riley Quinn', 'riley@example.com', '78702', '8th grade', 'RIL2M', 'waitlisted', now() - interval '2 days');

-- Maya referred Sam + Casey; Jordan referred Avery
update public.participants set referred_by_id = '11111111-1111-1111-1111-111111111111'
  where id in ('33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555');
update public.participants set referred_by_id = '22222222-2222-2222-2222-222222222222'
  where id = '44444444-4444-4444-4444-444444444444';

insert into public.referrals (referrer_id, referred_id, referred_name, referred_email, status, submission_method, created_at) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Sam Rivera', 'sam@example.com', 'waitlisted', 'link', now() - interval '8 days'),
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Casey Brooks', 'casey@example.com', 'waitlisted', 'link', now() - interval '3 days'),
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'Avery Kim', 'avery@example.com', 'waitlisted', 'staff_attributed', now() - interval '5 days');
