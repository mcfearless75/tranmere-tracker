-- Run in Supabase SQL Editor
-- LTI 1.3 (Learning Tools Interoperability) integration tables

-- Registered LMS platforms (one row per Moodle instance)
create table if not exists lti_platforms (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,                    -- e.g. "Wirral Met Moodle"
  issuer             text not null unique,             -- iss — e.g. https://moodle.college.ac.uk
  client_id          text not null,                    -- LTI client id assigned by the platform
  deployment_ids     text[] default '{}',              -- deployment ids (Moodle may issue 1+)
  auth_login_url     text not null,                    -- OIDC auth endpoint on the platform
  auth_token_url     text not null,                    -- token endpoint on the platform (for AGS)
  keyset_url         text not null,                    -- platform JWKS URL
  created_at         timestamptz default now()
);

-- Links an LTI user (platform-scoped sub) to our public.users row
create table if not exists lti_user_links (
  id                 uuid primary key default uuid_generate_v4(),
  platform_id        uuid not null references lti_platforms(id) on delete cascade,
  lti_sub            text not null,                    -- sub claim from id_token
  lti_email          text,
  lti_name           text,
  user_id            uuid not null references public.users(id) on delete cascade,
  roles              text[] default '{}',              -- LTI context roles
  created_at         timestamptz default now(),
  unique(platform_id, lti_sub)
);

-- Our tool's single RSA keypair (generated on first use, reused across platforms)
create table if not exists lti_keypair (
  id                 int primary key default 1 check (id = 1),
  kid                text not null,                    -- key id
  public_jwk         jsonb not null,
  private_pem        text not null,
  created_at         timestamptz default now()
);

alter table lti_platforms enable row level security;
alter table lti_user_links enable row level security;
alter table lti_keypair enable row level security;

drop policy if exists "staff manage lti platforms" on lti_platforms;
create policy "staff manage lti platforms" on lti_platforms for all using (public.is_staff());

drop policy if exists "staff read lti links" on lti_user_links;
create policy "staff read lti links" on lti_user_links for select using (public.is_staff());

-- (keypair is only accessed via service role — no public policies needed)
