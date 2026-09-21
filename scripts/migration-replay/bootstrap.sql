-- Minimal Supabase-shaped shim so a bare Postgres can replay this repo's
-- migrations the way a Supabase preview branch does: empty database, no data.
--
-- Only covers what supabase/migrations/*.sql actually reference --
-- auth.uid()/auth.role()/auth.jwt(), auth.users, the anon/authenticated/
-- service_role roles, storage.buckets/objects/foldername(), and the
-- supabase_realtime publication. Extend it if a migration starts using
-- something new (the replay will tell you).

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Roles that RLS policies grant to / reference.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator nologin noinherit; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

grant usage on schema auth, storage, public to anon, authenticated, service_role;

-- auth.users: the columns these migrations touch, plus the usual GoTrue
-- defaults so bare INSERTs behave the same way they do on Supabase.
create table if not exists auth.users (
  id                   uuid primary key default uuid_generate_v4(),
  instance_id          uuid,
  aud                  varchar(255),
  role                 varchar(255),
  email                varchar(255),
  encrypted_password   varchar(255),
  email_confirmed_at   timestamptz,
  invited_at           timestamptz,
  confirmation_token   varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token       varchar(255),
  recovery_sent_at     timestamptz,
  last_sign_in_at      timestamptz,
  raw_app_meta_data    jsonb default '{}'::jsonb,
  raw_user_meta_data   jsonb default '{}'::jsonb,
  is_super_admin       boolean,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  phone                text,
  banned_until         timestamptz,
  deleted_at           timestamptz,
  is_sso_user          boolean not null default false,
  is_anonymous         boolean not null default false
);

-- auth helpers, same semantics as Supabase's (read the request JWT GUCs).
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.email() returns text language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')::text
$$;

-- storage shim
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  owner              uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id               uuid primary key default uuid_generate_v4(),
  bucket_id        text references storage.buckets(id),
  name             text,
  owner            uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata         jsonb,
  path_tokens      text[]
);

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1 : array_length(parts, 1) - 1];
end $$;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

-- The realtime publication migrations ALTER. Their calls swallow exceptions,
-- so create it here rather than let those guards hide a real error.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
