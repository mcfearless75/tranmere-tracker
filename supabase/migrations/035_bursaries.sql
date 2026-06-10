-- Migration 035: Bursary management
-- Tracks bursary awards for students and the generated payment schedule.
-- Financial data: admin-only via RLS (NOT is_staff() — coaches/teachers must
-- not be able to read amounts).

create table if not exists public.bursaries (
  id                uuid          primary key default gen_random_uuid(),
  student_id        uuid          not null references public.users(id) on delete cascade,
  award_label       text          not null,
  amount_per_period numeric(8,2)  not null check (amount_per_period > 0),
  period            text          not null default 'monthly'
                      check (period in ('weekly', 'monthly', 'termly')),
  start_date        date          not null,
  end_date          date,
  status            text          not null default 'active'
                      check (status in ('active', 'suspended', 'ended')),
  notes             text,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create table if not exists public.bursary_payments (
  id          uuid          primary key default gen_random_uuid(),
  bursary_id  uuid          not null references public.bursaries(id) on delete cascade,
  due_date    date          not null,
  amount      numeric(8,2)  not null,
  status      text          not null default 'pending'
                check (status in ('pending', 'paid', 'skipped')),
  paid_at     timestamptz,
  marked_by   uuid          references public.users(id) on delete set null,
  note        text,
  created_at  timestamptz   not null default now()
);

-- Indexes
create index if not exists bursaries_student_id_idx on public.bursaries (student_id);
create index if not exists bursary_payments_bursary_id_idx on public.bursary_payments (bursary_id);
create index if not exists bursary_payments_due_date_idx on public.bursary_payments (due_date);

-- updated_at trigger
create or replace function public.set_bursaries_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bursaries_updated_at
  before update on public.bursaries
  for each row execute function public.set_bursaries_updated_at();

-- Row Level Security
alter table public.bursaries        enable row level security;
alter table public.bursary_payments enable row level security;

-- Admins only: full access to bursaries
create policy "admins all bursaries"
  on public.bursaries for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Admins only: full access to bursary payments
create policy "admins all bursary payments"
  on public.bursary_payments for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
