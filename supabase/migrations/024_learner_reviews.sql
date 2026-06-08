-- Learner reviews (termly 1-to-1s)
create table if not exists public.learner_reviews (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.users(id) on delete cascade,
  reviewer_id   uuid references public.users(id) on delete set null,
  term          text not null,                          -- e.g. 'Autumn 2025'
  scheduled_for date,
  status        text not null default 'draft'           -- draft | submitted | complete
                check (status in ('draft', 'submitted', 'complete')),
  ai_summary    jsonb,
  actions       jsonb,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Answers captured during the 1-to-1
create table if not exists public.review_answers (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.learner_reviews(id) on delete cascade,
  question_key text not null,
  answer      text not null,
  unique (review_id, question_key)
);

-- Indexes
create index if not exists learner_reviews_student_idx on public.learner_reviews(student_id);
create index if not exists learner_reviews_status_idx  on public.learner_reviews(status);
create index if not exists review_answers_review_idx   on public.review_answers(review_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learner_reviews_updated_at on public.learner_reviews;
create trigger learner_reviews_updated_at
  before update on public.learner_reviews
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.learner_reviews enable row level security;
alter table public.review_answers  enable row level security;

-- Students can read their own reviews
create policy "students_read_own_reviews"
  on public.learner_reviews for select
  using (student_id = auth.uid());

-- Admins full access to reviews
create policy "admins_all_reviews"
  on public.learner_reviews for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Students can read their own review answers
create policy "students_read_own_answers"
  on public.review_answers for select
  using (
    exists (
      select 1 from public.learner_reviews lr
      where lr.id = review_id and lr.student_id = auth.uid()
    )
  );

-- Admins full access to answers
create policy "admins_all_answers"
  on public.review_answers for all
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
