-- Catapult One CSV import: player cloud codes + source value.
alter table public.users add column if not exists catapult_code text;

create unique index if not exists users_catapult_code_lower_idx
  on public.users (lower(catapult_code))
  where catapult_code is not null and btrim(catapult_code) <> '';

alter table public.gps_sessions drop constraint if exists gps_sessions_source_check;

alter table public.gps_sessions
  add constraint gps_sessions_source_check
  check (source in ('statsports', 'phone', 'manual', 'catapult'));

-- Best-effort smoke-test seed. No-op if the name is not on the roster yet.
update public.users
set catapult_code = 'Tranmere P27'
where role = 'student'
  and catapult_code is null
  and name ilike '%Caleb McWilliam%';
