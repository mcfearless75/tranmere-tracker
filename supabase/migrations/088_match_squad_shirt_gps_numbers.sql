-- Per-match shirt and GPS pod numbers on the squad.
--
-- Catapult exports identify a player only by pod ("Tranmere P13"), and pods
-- are handed out fresh each match. The permanent users.catapult_code could not
-- say "P13 was Caleb McWilliam on 23/09" (his permanent code is P27), so the
-- import either matched nobody or put a pod's data on whoever owned that code.
-- The pod → player link belongs to the fixture, so it lives here.
--
-- Unique per match, DEFERRABLE INITIALLY DEFERRED: the numbers panel saves the
-- whole squad in one upsert, and a swap (A 4→5, B 5→4) would trip an
-- immediately-checked constraint on the first row even though the final state
-- is valid. NULLs never clash, so unnumbered players are fine.
--
-- Safe to re-run.

alter table public.match_squads add column if not exists shirt_number smallint;
alter table public.match_squads add column if not exists gps_number smallint;

alter table public.match_squads drop constraint if exists match_squads_shirt_number_range;
alter table public.match_squads
  add constraint match_squads_shirt_number_range check (shirt_number between 1 and 99);

alter table public.match_squads drop constraint if exists match_squads_gps_number_range;
alter table public.match_squads
  add constraint match_squads_gps_number_range check (gps_number between 1 and 99);

alter table public.match_squads drop constraint if exists match_squads_shirt_number_unique;
alter table public.match_squads
  add constraint match_squads_shirt_number_unique unique (match_id, shirt_number)
  deferrable initially deferred;

alter table public.match_squads drop constraint if exists match_squads_gps_number_unique;
alter table public.match_squads
  add constraint match_squads_gps_number_unique unique (match_id, gps_number)
  deferrable initially deferred;

comment on column public.match_squads.shirt_number is
  'Shirt worn in this match. Allocated fresh each fixture.';
comment on column public.match_squads.gps_number is
  'Catapult pod worn in this match — "Tranmere P<n>" in the export. The GPS import resolves pods through this, per match.';
