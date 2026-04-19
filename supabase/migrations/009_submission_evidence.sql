-- Run in Supabase SQL Editor
-- Lets students attach evidence (photos, files, Google Doc links) to their
-- BTEC submissions, and exchange messages with teachers per assignment.

create table if not exists submission_evidence (
  id              uuid primary key default uuid_generate_v4(),
  submission_id   uuid not null references submissions(id) on delete cascade,
  student_id      uuid not null references public.users(id) on delete cascade,
  kind            text not null check (kind in ('file', 'link', 'photo')),
  url             text not null,
  filename        text,
  note            text,
  uploaded_at     timestamptz default now()
);

create index if not exists submission_evidence_sub on submission_evidence(submission_id);
create index if not exists submission_evidence_student on submission_evidence(student_id);

alter table submission_evidence enable row level security;

create policy "students manage own evidence"
  on submission_evidence for all
  using (student_id = auth.uid());

create policy "staff read all evidence"
  on submission_evidence for select
  using (public.is_staff());

-- Assignment-level message thread between student and staff
create table if not exists assignment_messages (
  id              uuid primary key default uuid_generate_v4(),
  assignment_id   uuid not null references assignments(id) on delete cascade,
  student_id      uuid not null references public.users(id) on delete cascade,
  sender_id       uuid not null references public.users(id),
  sender_role     text not null check (sender_role in ('student', 'staff')),
  message         text not null,
  created_at      timestamptz default now()
);

create index if not exists assignment_messages_thread on assignment_messages(assignment_id, student_id);

alter table assignment_messages enable row level security;

-- Student can read/write their own messages on their own assignments
create policy "students read own messages"
  on assignment_messages for select
  using (student_id = auth.uid());

create policy "students insert own messages"
  on assignment_messages for insert
  with check (student_id = auth.uid() and sender_id = auth.uid() and sender_role = 'student');

-- Staff see everything and can post as staff
create policy "staff read all messages"
  on assignment_messages for select
  using (public.is_staff());

create policy "staff insert messages"
  on assignment_messages for insert
  with check (public.is_staff() and sender_role = 'staff');
