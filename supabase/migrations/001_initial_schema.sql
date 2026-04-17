-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Run this manually in the Supabase SQL Editor:
--   1. Open your Supabase project dashboard
--   2. Go to SQL Editor (left sidebar)
--   3. Paste the contents of this file and click Run
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Courses
create table courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null
);

insert into courses (name) values
  ('Level 2 Public Services / Fitness'),
  ('Level 3 Sports Science'),
  ('Level 3 Sports Coaching');

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('student', 'coach', 'admin')),
  course_id uuid references courses(id),
  avatar_url text,
  created_at timestamptz default now()
);

-- BTEC Units
create table btec_units (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id),
  unit_number text not null,
  unit_name text not null
);

-- Assignments
create table assignments (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references btec_units(id),
  title text not null,
  description text,
  due_date date not null,
  grade_target text check (grade_target in ('Pass', 'Merit', 'Distinction')),
  created_at timestamptz default now()
);

-- Submissions
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references assignments(id),
  student_id uuid not null references public.users(id),
  status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','graded')),
  grade text,
  feedback text,
  submitted_at timestamptz,
  unique(assignment_id, student_id)
);

-- Nutrition goals
create table nutrition_goals (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id) unique,
  calories int not null default 2500,
  protein_g int not null default 150,
  carbs_g int not null default 300,
  fat_g int not null default 80,
  set_by uuid references public.users(id)
);

-- Nutrition logs
create table nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id),
  logged_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name text not null,
  barcode text,
  calories int not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  created_at timestamptz default now()
);

-- Training logs
create table training_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id),
  session_date date not null default current_date,
  session_type text not null,
  duration_mins int not null,
  intensity text not null check (intensity in ('low','medium','high')),
  notes text,
  created_at timestamptz default now()
);

-- Match logs
create table match_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id),
  match_date date not null,
  opponent text not null,
  goals int not null default 0,
  assists int not null default 0,
  minutes_played int not null,
  position text,
  self_rating int check (self_rating between 1 and 10),
  notes text,
  created_at timestamptz default now()
);

-- Push subscriptions
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- Row Level Security
alter table public.users enable row level security;
alter table submissions enable row level security;
alter table nutrition_goals enable row level security;
alter table nutrition_logs enable row level security;
alter table training_logs enable row level security;
alter table match_logs enable row level security;
alter table push_subscriptions enable row level security;
alter table courses enable row level security;
alter table btec_units enable row level security;
alter table assignments enable row level security;

-- Users: read own row; admin/coach read all
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_select_admin" on public.users for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Submissions: student owns their own
create policy "submissions_student" on submissions for all using (auth.uid() = student_id);
create policy "submissions_admin" on submissions for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Nutrition logs: student owns
create policy "nutrition_logs_own" on nutrition_logs for all using (auth.uid() = student_id);
create policy "nutrition_logs_coach" on nutrition_logs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Nutrition goals: coach sets, student reads
create policy "nutrition_goals_read" on nutrition_goals for select using (
  auth.uid() = student_id or
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);
create policy "nutrition_goals_write" on nutrition_goals for all
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
  );

-- Training/match: student owns, coach reads
create policy "training_own" on training_logs for all using (auth.uid() = student_id);
create policy "training_coach" on training_logs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);
create policy "match_own" on match_logs for all using (auth.uid() = student_id);
create policy "match_coach" on match_logs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Push subscriptions: own only
create policy "push_own" on push_subscriptions for all using (auth.uid() = user_id);

-- Courses + units: any authenticated user can read
create policy "courses_auth_read" on courses for select
  using (auth.role() = 'authenticated');

create policy "btec_units_auth_read" on btec_units for select
  using (auth.role() = 'authenticated');

-- Assignments: authenticated users read, coaches/admin write
create policy "assignments_auth_read" on assignments for select
  using (auth.role() = 'authenticated');

create policy "assignments_admin_write" on assignments for insert
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
  );

create policy "assignments_admin_update" on assignments for update
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
  );

create policy "assignments_admin_delete" on assignments for delete
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
  );

-- Trigger: auto-create public.users row on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,'unknown@unknown.com'),'@',1)), coalesce(new.raw_user_meta_data->>'role','student'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
