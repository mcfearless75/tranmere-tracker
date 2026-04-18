-- Run in Supabase SQL Editor

-- GPS sessions imported from STATSports or phone GPS
create table if not exists gps_sessions (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.users(id) on delete cascade,
  session_date    date not null,
  session_label   text,                    -- e.g. "Training" or "vs Everton"
  source          text default 'statsports' check (source in ('statsports', 'phone', 'manual')),

  -- Core distance metrics (metres)
  total_distance_m      numeric(8,1),
  hsr_distance_m        numeric(8,1),      -- high speed running (>5.5 m/s)
  sprint_distance_m     numeric(8,1),      -- sprinting (>7 m/s)

  -- Speed
  max_speed_ms          numeric(5,2),      -- m/s
  max_speed_kmh         numeric(5,1),      -- km/h

  -- Counts
  sprint_count          int,
  accel_count           int,               -- accelerations
  decel_count           int,               -- decelerations

  -- Load
  player_load           numeric(8,2),

  -- Heart rate (APEX Pro)
  hr_avg                int,
  hr_max                int,

  -- Duration
  duration_mins         numeric(5,1),

  imported_by   uuid references public.users(id),
  created_at    timestamptz default now()
);

alter table gps_sessions enable row level security;

-- Coaches/admin can insert and view all; students see their own
create policy "staff manage gps_sessions"
  on gps_sessions for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','coach'))
  );

create policy "students view own gps"
  on gps_sessions for select
  using (player_id = auth.uid());
