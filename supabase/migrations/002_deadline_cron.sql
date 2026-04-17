-- Tranmere Tracker — Deadline Reminder Cron Setup
-- Run this in the Supabase SQL Editor AFTER enabling pg_cron.
--
-- To enable pg_cron in Supabase:
-- 1. Go to your project → Database → Extensions
-- 2. Enable the "pg_cron" extension
--
-- This SQL sets up a daily job at 8am UTC that finds assignments
-- due in 7 or 1 day(s) and triggers push notifications via Edge Function.
--
-- PREREQUISITE: Deploy the Edge Function first (see supabase/functions/deadline-reminder/)

-- Enable pg_cron (if not already done via dashboard)
-- create extension if not exists pg_cron;

-- Schedule daily check at 08:00 UTC
-- Calls a Supabase Edge Function that handles the push sends
select cron.schedule(
  'deadline-reminders',           -- job name (unique)
  '0 8 * * *',                    -- cron: every day at 08:00 UTC
  $$
    select net.http_post(
      url    := current_setting('app.edge_function_url') || '/deadline-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
      body    := '{}'::jsonb
    ) as request_id;
  $$
);

-- To verify the job was created:
-- select * from cron.job;

-- To remove the job if needed:
-- select cron.unschedule('deadline-reminders');
