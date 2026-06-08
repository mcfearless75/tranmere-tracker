-- Migration 030: Safeguarding case workflow
-- Tracks safeguarding concerns raised about students, with a status workflow
-- and an append-only notes timeline. Admins only via RLS.

create table if not exists public.safeguarding_concerns (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references public.users(id) on delete cascade,
  raised_by   uuid        references public.users(id) on delete set null,
  category    text        not null default 'wellbeing'
                check (category in ('wellbeing', 'behaviour', 'attendance', 'physical', 'online', 'other')),
  severity    text        not null default 'medium'
                check (severity in ('low', 'medium', 'high')),
  description text        not null,
  status      text        not null default 'open'
                check (status in ('open', 'monitoring', 'escalated', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.safeguarding_notes (
  id          uuid        primary key default gen_random_uuid(),
  concern_id  uuid        not null references public.safeguarding_concerns(id) on delete cascade,
  author_id   uuid        references public.users(id) on delete set null,
  note        text        not null,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists safeguarding_concerns_student_id_idx on public.safeguarding_concerns (student_id);
create index if not exists safeguarding_concerns_status_idx on public.safeguarding_concerns (status);
create index if not exists safeguarding_concerns_severity_idx on public.safeguarding_concerns (severity);
create index if not exists safeguarding_concerns_created_at_idx on public.safeguarding_concerns (created_at desc);
create index if not exists safeguarding_notes_concern_id_idx on public.safeguarding_notes (concern_id);

-- updated_at trigger
create or replace function public.set_safeguarding_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger safeguarding_concerns_updated_at
  before update on public.safeguarding_concerns
  for each row execute function public.set_safeguarding_updated_at();

-- Row Level Security
alter table public.safeguarding_concerns enable row level security;
alter table public.safeguarding_notes    enable row level security;

-- Admins only: full access to concerns
create policy "admins all safeguarding concerns"
  on public.safeguarding_concerns for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Admins only: full access to notes
create policy "admins all safeguarding notes"
  on public.safeguarding_notes for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
