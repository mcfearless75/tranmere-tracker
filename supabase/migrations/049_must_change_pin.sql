-- 049_must_change_pin.sql
-- Nudges students still on the shared default PIN (000000) to set a personal
-- one. We can't inspect an actual password/PIN value (correctly — it's
-- hashed), so this flag is set explicitly whenever we know an account is on
-- a shared default, and cleared by the self-service change-PIN flow once
-- the student sets their own.

alter table public.users
  add column if not exists must_change_pin boolean not null default false;

-- Backfill: the 50 students bulk-created/switched onto the shared 000000
-- PIN (username@tranmeretracker.internal login, real email kept in
-- contact_email) all start flagged.
update public.users
set must_change_pin = true
where role = 'student'
  and email like '%@tranmeretracker.internal'
  and contact_email is not null;
