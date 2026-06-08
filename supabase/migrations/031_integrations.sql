-- Run in Supabase SQL Editor
-- External integration connection scaffolding (Moodle / VEO / Catapult / GURU /
-- Sports Session Planner). Stores per-provider connection config so integrations
-- go live the moment API keys are pasted into the admin UI.
--
-- SECURITY: the `config` jsonb holds secrets (API keys, tokens). It is read and
-- written ONLY via the service-role client in server code. RLS denies all access
-- to anon / authenticated roles, so secrets are never exposed to the browser.

create table if not exists public.integration_configs (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null unique
                check (provider in ('moodle','veo','catapult','guru','sports_session_planner')),
  enabled     boolean not null default false,
  base_url    text,
  config      jsonb not null default '{}'::jsonb,   -- keys / secrets — service-role only
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create index if not exists integration_configs_provider_idx
  on public.integration_configs(provider);

alter table public.integration_configs enable row level security;

-- No anon/authenticated policies are created on purpose. With RLS enabled and no
-- permissive policy, only the service-role key (which bypasses RLS) can touch the
-- table. All admin access is brokered through server routes that verify the
-- caller's role first, so secrets never leave the server.
