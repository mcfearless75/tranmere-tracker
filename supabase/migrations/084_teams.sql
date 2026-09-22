-- ============================================================================
-- 084_teams.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-22: the club runs three standing teams — Prem, White and Blue — and
-- the app had no idea they existed. Coaches picking a match squad were shown
-- one flat list of every active student and had to remember who was in which
-- team.
--
-- Teams are a table, not an enum, so coaches can rename, reorder, add a fourth
-- or retire one without a deploy.
--
-- One team per player, enforced structurally by users.team_id being a single
-- column. team_id is NULLABLE on purpose: new joiners, trialists and injured
-- players legitimately have no team, and a NOT NULL default would repeat the
-- bug that made every Year 2 joiner silently a Year 1 (see updateUserYearGroup).
--
-- Membership is ROLE-AGNOSTIC. Joseph Barton ("Joseph B") is a coach who plays
-- and is on the Prem sheet; the squad pickers used to hard-filter
-- role='student', so he could never be picked. Having a team is now what makes
-- someone pickable.
--
-- ⚠ RE-RUN WARNING — READ BEFORE RE-APPLYING THIS FILE AFTER GO-LIVE ⚠
--
-- The table/column/policy DDL above is genuinely idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE POLICY throughout). The roster SEED below is NOT safe to
-- re-run once a coach has started using the Teams page.
--
-- The seed's `u.team_id is null` guard only protects a MOVE (A → B leaves
-- team_id non-null, so a re-run correctly skips it). It does NOT protect a
-- REMOVAL: taking a player out of a team sets team_id back to NULL — exactly
-- the state the guard is watching for — so re-running this file after a coach
-- has removed someone will silently put them straight back on the roster
-- (e.g. Javan Moussa back in Blue after being deliberately removed). There is
-- no "was this ever touched" marker, and adding one would be over-engineering
-- for a script that should just not be re-run.
--
-- So: this file is safe to apply exactly once, before the Teams page is used
-- for real. After that, re-running it is a live-data hazard, not a no-op.
--
-- The team INSERT below has a smaller version of the same hazard: it matches
-- an ACTIVE team named 'Prem' (etc). If a coach renames Prem before a re-run,
-- the name no longer matches, `not exists` is true, and re-running creates a
-- second, empty 'Prem' — the unique index only blocks two teams sharing a
-- name, and a renamed team no longer shares it.
--
-- NOTE FOR MIGRATION REPLAY: the seed is an UPDATE against hardcoded production
-- user ids. On a blank database it matches zero rows and succeeds. Do NOT turn
-- it into an INSERT referencing those ids — that is what broke replay at 054.
-- ============================================================================

create table if not exists public.teams (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

-- Two ACTIVE teams cannot share a name; a retired team's name is reusable.
create unique index if not exists teams_name_active_idx
  on public.teams (lower(name)) where is_active;

alter table public.users
  add column if not exists team_id uuid references public.teams(id) on delete set null;

-- ON DELETE SET NULL, never cascade: deleting a team must not delete players.
alter table public.match_events
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists users_team_id_idx on public.users (team_id);
create index if not exists match_events_team_id_idx on public.match_events (team_id);

alter table public.teams enable row level security;

drop policy if exists "staff manage teams" on public.teams;
create policy "staff manage teams" on public.teams
  for all using (public.is_staff()) with check (public.is_staff());

-- Students and parents read team names to render a badge.
drop policy if exists "authenticated read teams" on public.teams;
create policy "authenticated read teams" on public.teams
  for select using (auth.uid() is not null);

-- ── Seed the three teams ────────────────────────────────────────────────────
insert into public.teams (name, sort_order)
select v.name, v.sort_order
from (values ('Prem', 0::smallint), ('White', 1::smallint), ('Blue', 2::smallint)) as v(name, sort_order)
where not exists (
  select 1 from public.teams t where lower(t.name) = lower(v.name) and t.is_active
);

-- ── Seed the rosters ────────────────────────────────────────────────────────
-- Transcribed from "College Squad Lists 2026/27" and matched to user ids.
-- Seeded by id, not name: three of the 46 names were spelled differently on
-- the sheet than in the app (Robert Ewan Duncan/Ewan Duncan, Ollie/Oliver
-- Piercy, Seb Macauley/Sebastian MacAulay).

update public.users u set team_id = t.id
from public.teams t
where t.name = 'Prem' and t.is_active and u.team_id is null and u.id in (
  'afc86107-fac9-475a-9053-aa28349c48c4',  -- Alfie Casey
  'c4bc75d1-6ad1-40a1-985c-8df3f1c1efa2',  -- Beau Edwards
  '8e230c3a-a84e-426f-a176-42d310d5f14e',  -- Caleb McWilliam
  'a2763c60-0723-4f6d-994b-4854d64fc17a',  -- Dylan Bullock
  'cafc6fe4-5b52-4c44-9ade-7b2528b0df85',  -- Ewan Duncan  (sheet: Robert Ewan Duncan)
  '047d8c7e-1d0f-4e45-bd2d-0536ab70de5c',  -- Harris McIntosh
  'f80f8bce-0bfb-4ff6-a1ce-d6a8d41d42ab',  -- Isaac Kennedy
  '11e25b83-836d-41a3-bea3-d4fa957886bb',  -- Jacob Garnett
  'a62b3cca-1e86-48d9-b6d2-e20f296e2778',  -- James Lowther
  'd1d02a54-c57f-4378-ad47-9f32f3d7ea97',  -- Joseph B  (role=coach, plays)
  '4c5e96ff-c049-4877-8503-ff15d4f4d2f6',  -- Liam Blake
  '480f184e-787b-4060-bb49-bad5de8c68e2',  -- Luke Proudlove
  'b9f2d1c2-f5a7-4d2b-aefe-1c4ccff32f4b',  -- Mark Omolade
  '2548cc77-2613-4bd8-8098-a02f6e38a19c',  -- Naod Tewolde
  'bda87bcb-e464-4609-9bf6-8ca9406169a2',  -- Oliver Piercy  (sheet: Ollie Piercy)
  '45cc5a52-323a-48ae-b294-09851f5818a9',  -- Preston Cleator
  'faf65055-e936-47b7-a071-953781e29883'   -- Sebastian MacAulay  (sheet: Seb Macauley)
);

update public.users u set team_id = t.id
from public.teams t
where t.name = 'Blue' and t.is_active and u.team_id is null and u.id in (
  'd225c75b-e8cf-4540-aae8-8f769622cfd0',  -- Lewis Boden
  '583f1126-4a09-4167-8884-099ceca42049',  -- Ollie Carson
  '6e6ab73c-2456-4edb-9b99-a8f453f9c38f',  -- Marcus Dos Santos
  'd22c1bde-74df-4605-be88-cbba2f93c24e',  -- Jonah Jones
  '6670952c-2fab-4985-8ef7-9332ee0066aa',  -- Kieron Murphy
  'cfc49190-63f4-4c3c-bff8-12270481b3c6',  -- Samuel Nash
  'c5929870-2aaf-4d33-8ddf-6972b16f436d',  -- Joshua Upton
  'a74e43f2-9306-4734-93f8-b15147c25371',  -- Jack Brindley
  '6c329cad-8fba-4444-9532-78f82101f965',  -- Lewis Dooley
  '7ed45be5-c91a-4ff9-9f76-5f74a8fba7e0',  -- Lewis Cubbins
  '91161e9e-1a74-47f4-b5a5-feaa613251ad',  -- Jamie Cunningham
  '97b1c970-6efa-47ed-b8bb-f11d85bfeb6a',  -- Troy Lockyer
  '6abd15d0-5516-449d-8828-042038994d96',  -- Tinashe Makoni
  'e4e6a7b5-a0cc-4356-93d1-292fac1b3a2b'   -- Javan Moussa
);

update public.users u set team_id = t.id
from public.teams t
where t.name = 'White' and t.is_active and u.team_id is null and u.id in (
  '658f875a-6ae1-47e0-94ff-897e54c40a89',  -- Kenneth Chimhuva
  '9bbae31b-1c40-4ff4-b12c-07929e1a1246',  -- Liam Gray
  '3fa12548-d7ab-40b7-878b-833f4b3cbeba',  -- Charlie Lawler
  'a73f12e9-5ffc-4957-b4eb-9909ec11e35d',  -- Kaelin Owen
  '83d1bd61-d986-41ff-9350-db2ab9031d56',  -- Caspar Quilty
  '6c9905de-5192-4a24-99e7-b3330e239a6d',  -- Mason Smith
  '53f42d8a-435b-4fa1-9345-8c770e8c360d',  -- Joshua Williams
  'cc9c1bf1-aa70-4c7a-bb73-b2d5d73491b8',  -- Jeff Osazuwa
  '3a0159bd-3529-4dbf-9b1e-b43eabdbbd0c',  -- Lamin Manjang
  '08599ebd-0c91-4261-a39e-f6ddb4c380e8',  -- Leighton Kelly
  'd71490c1-352b-43cc-b767-3cd7f163b7b2',  -- Aidan O'Brien
  'd02194d1-531f-4970-ae4e-481e6dc85a56',  -- Max Roberts
  '7ff08fac-3e27-48a1-9d67-c6f1f8ea09d8',  -- Jack Roddick
  '7cac9bc1-8e6a-4752-9440-0628590de88f',  -- Oliver Wilson
  'c4fbdc77-b75f-4522-b7b7-d0879d1ed1b2'   -- Jayden McAuley
);
