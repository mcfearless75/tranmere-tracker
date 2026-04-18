-- Run in Supabase SQL Editor
-- Repairs any superuser whose role was accidentally clobbered to 'student'
-- by the old dashboard auto-upsert (fixed in commit after this migration).

update public.users
set role = 'admin'
where email = 'superuser@tranmeretracker.internal';

-- If the row is missing entirely, you'll need to re-run /setup.
-- Check the result:
--   select id, name, email, role from public.users where email = 'superuser@tranmeretracker.internal';
