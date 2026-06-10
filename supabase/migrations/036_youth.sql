-- Migration 036: Youth football section
-- Staff-managed youth squads, players, and fixtures. Youth players are
-- children and have NO logins — the parent/guardian is the contact,
-- consistent with the platform's safeguarding posture.
-- Staff-only via RLS using the existing is_staff() helper (migration 008).

create table if not exists public.youth_squads (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  age_group  text        not null,
  coach_id   uuid        references public.users(id) on delete set null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.youth_players (
  id                   uuid        primary key default gen_random_uuid(),
  squad_id             uuid        not null references public.youth_squads(id) on delete cascade,
  first_name           text        not null,
  last_name            text        not null,
  date_of_birth        date        not null,
  parent_guardian_name text        not null,
  parent_contact_email text        not null,
  parent_contact_phone text,
  medical_notes        text,
  consent_given        boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.youth_fixtures (
  id           uuid        primary key default gen_random_uuid(),
  squad_id     uuid        not null references public.youth_squads(id) on delete cascade,
  opponent     text        not null,
  fixture_date date        not null,
  kick_off     time,
  location     text,
  home_away    text        not null default 'home'
                 check (home_away in ('home', 'away')),
  result_home  smallint,
  result_away  smallint,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists youth_players_squad_id_idx on public.youth_players (squad_id);
create index if not exists youth_fixtures_squad_id_idx on public.youth_fixtures (squad_id);
create index if not exists youth_fixtures_fixture_date_idx on public.youth_fixtures (fixture_date);

-- updated_at trigger
create or replace function public.set_youth_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger youth_squads_updated_at
  before update on public.youth_squads
  for each row execute function public.set_youth_updated_at();

create trigger youth_players_updated_at
  before update on public.youth_players
  for each row execute function public.set_youth_updated_at();

-- Row Level Security
alter table public.youth_squads   enable row level security;
alter table public.youth_players  enable row level security;
alter table public.youth_fixtures enable row level security;

-- Staff only: full access to youth squads
create policy "staff all youth squads"
  on public.youth_squads for all
  using (is_staff())
  with check (is_staff());

-- Staff only: full access to youth players
create policy "staff all youth players"
  on public.youth_players for all
  using (is_staff())
  with check (is_staff());

-- Staff only: full access to youth fixtures
create policy "staff all youth fixtures"
  on public.youth_fixtures for all
  using (is_staff())
  with check (is_staff());
