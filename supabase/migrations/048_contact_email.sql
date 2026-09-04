-- 048_contact_email.sql
-- Some students log in via a short username + PIN (username@tranmeretracker.internal
-- as the auth email), which means their real institutional email can't also be
-- the auth `email` column. Store it here instead so it's kept for reference/comms.

alter table public.users
  add column if not exists contact_email text;
