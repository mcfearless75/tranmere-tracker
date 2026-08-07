-- 039_match_events_student_select.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- FIX 1 (functional): match_events has NO student SELECT policy. The only
-- policy on the table is "staff can manage match_events" (008_fix_rls_recursion.sql),
-- so a player who has been picked for a match (has a match_squads row) can see
-- their squad entry but cannot read the match itself — date, opponent,
-- location, notes all come back empty under RLS. Grant students SELECT on
-- exactly the matches they are linked to via match_squads.
--
-- Recursion note: match_squads policies reference only player_id and the
-- SECURITY DEFINER public.is_staff() helper — never match_events — so the
-- subquery below cannot recurse. The player's own "players see own squad
-- entries" policy (player_id = auth.uid()) is what makes the EXISTS visible.

drop policy if exists "players see their own matches" on match_events;

create policy "players see their own matches"
  on match_events for select
  using (
    exists (
      select 1
      from match_squads
      where match_squads.match_id = match_events.id
        and match_squads.player_id = auth.uid()
    )
  );

-- FIX 2 (shared-device hygiene): a web-push endpoint identifies a DEVICE, not
-- a user. The table only had unique(user_id, endpoint), so when a second
-- account logged in on a shared device both users kept live subscription rows
-- for the same endpoint and the previous user's notifications continued to
-- arrive on that device. app/api/push/subscribe now deletes other users' rows
-- for the endpoint before upserting; this constraint enforces the invariant at
-- the database level against races. Dedupe first (keep the newest row per
-- endpoint) so the constraint can be added on live data.

delete from public.push_subscriptions ps
where ps.id not in (
  select distinct on (endpoint) id
  from public.push_subscriptions
  order by endpoint, created_at desc nulls last, id
);

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_key;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_key unique (endpoint);

-- Verification (run separately):
--
-- 1. Policy exists (should return 1 row):
--   SELECT policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename = 'match_events'
--     AND policyname = 'players see their own matches';
--
-- 2. As a student who is in at least one squad (run with that user's JWT via
--    PostgREST, or SET request.jwt.claims locally): should now return their
--    matches, and ONLY their matches:
--   SELECT id, match_date, opponent FROM match_events;
--
-- 3. Endpoint uniqueness (should return 0 rows):
--   SELECT endpoint, count(*) FROM public.push_subscriptions
--   GROUP BY endpoint HAVING count(*) > 1;
