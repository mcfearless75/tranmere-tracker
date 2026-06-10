-- Migration 034: Recruitment portal
-- Tracks prospective players (mostly minors — consent + parent/guardian required),
-- trial events, trial attendance, and a staff notes timeline.
-- Staff-only via RLS using the existing is_staff() helper (migration 008).
-- The public intake form inserts via the SERVICE ROLE in an API route,
-- so no anon policies are needed.

create table if not exists public.recruitment_prospects (
  id                   uuid        primary key default gen_random_uuid(),
  first_name           text        not null,
  last_name            text        not null,
  date_of_birth        date        not null,
  position             text,
  preferred_foot       text        check (preferred_foot in ('left', 'right', 'both')),
  current_club         text,
  contact_email        text        not null,
  contact_phone        text,
  parent_guardian_name text        not null,
  consent_given        boolean     not null default false,
  notes                text,
  source               text        not null default 'public_form'
                         check (source in ('public_form', 'staff')),
  status               text        not null default 'new'
                         check (status in ('new', 'reviewing', 'invited', 'trialled', 'offered', 'signed', 'rejected')),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create table if not exists public.trial_events (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  event_date date        not null,
  location   text,
  notes      text,
  created_at timestamptz default now()
);

create table if not exists public.trial_attendees (
  id             uuid     primary key default gen_random_uuid(),
  trial_event_id uuid     not null references public.trial_events(id) on delete cascade,
  prospect_id    uuid     not null references public.recruitment_prospects(id) on delete cascade,
  attended       boolean  not null default false,
  rating         smallint check (rating between 1 and 10),
  scout_notes    text,
  unique (trial_event_id, prospect_id)
);

create table if not exists public.prospect_notes (
  id          uuid        primary key default gen_random_uuid(),
  prospect_id uuid        not null references public.recruitment_prospects(id) on delete cascade,
  author_id   uuid        not null references public.users(id),
  note        text        not null,
  created_at  timestamptz default now()
);

-- Indexes
create index if not exists recruitment_prospects_status_idx on public.recruitment_prospects (status);
create index if not exists trial_events_event_date_idx on public.trial_events (event_date);
create index if not exists trial_attendees_prospect_id_idx on public.trial_attendees (prospect_id);
create index if not exists prospect_notes_prospect_id_idx on public.prospect_notes (prospect_id);

-- updated_at trigger
create or replace function public.set_recruitment_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recruitment_prospects_updated_at
  before update on public.recruitment_prospects
  for each row execute function public.set_recruitment_updated_at();

-- Row Level Security
alter table public.recruitment_prospects enable row level security;
alter table public.trial_events          enable row level security;
alter table public.trial_attendees       enable row level security;
alter table public.prospect_notes        enable row level security;

-- Staff only: full access to prospects
create policy "staff all recruitment prospects"
  on public.recruitment_prospects for all
  using (is_staff())
  with check (is_staff());

-- Staff only: full access to trial events
create policy "staff all trial events"
  on public.trial_events for all
  using (is_staff())
  with check (is_staff());

-- Staff only: full access to trial attendees
create policy "staff all trial attendees"
  on public.trial_attendees for all
  using (is_staff())
  with check (is_staff());

-- Staff only: full access to prospect notes
create policy "staff all prospect notes"
  on public.prospect_notes for all
  using (is_staff())
  with check (is_staff());
