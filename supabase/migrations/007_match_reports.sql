-- Run in Supabase SQL Editor
-- Adds post-match report fields to match_events + per-player stats to match_squads

alter table match_events
  add column if not exists home_score      int,
  add column if not exists away_score      int,
  add column if not exists motm_player_id  uuid references public.users(id),
  add column if not exists report_text     text,
  add column if not exists lessons_learned text,
  add column if not exists report_updated_at timestamptz;

alter table match_squads
  add column if not exists goals          int default 0,
  add column if not exists assists        int default 0,
  add column if not exists minutes_played int,
  add column if not exists yellow_card    boolean default false,
  add column if not exists red_card       boolean default false;
