-- ============================================================================
-- 018_player_attributes.sql
-- Adds physical / playing attributes to the users table so coaches can plan
-- formations, link nutrition (weight) and conditioning (build) targets,
-- and surface them on the player profile.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth   date,
  ADD COLUMN IF NOT EXISTS position        text,
  ADD COLUMN IF NOT EXISTS height_cm       int,
  ADD COLUMN IF NOT EXISTS weight_kg       numeric(5, 1),
  ADD COLUMN IF NOT EXISTS build           text,
  ADD COLUMN IF NOT EXISTS dominant_foot   text;

-- Soft constraints — keep values consistent for formation/nutrition wiring
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_position_chk;
ALTER TABLE public.users ADD CONSTRAINT users_position_chk
  CHECK (position IS NULL OR position IN (
    'Goalkeeper', 'Centre-Back', 'Full-Back', 'Wing-Back',
    'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder',
    'Winger', 'Striker', 'Forward'
  ));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_build_chk;
ALTER TABLE public.users ADD CONSTRAINT users_build_chk
  CHECK (build IS NULL OR build IN ('Slim', 'Athletic', 'Stocky', 'Heavy'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_foot_chk;
ALTER TABLE public.users ADD CONSTRAINT users_foot_chk
  CHECK (dominant_foot IS NULL OR dominant_foot IN ('Left', 'Right', 'Both'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_height_chk;
ALTER TABLE public.users ADD CONSTRAINT users_height_chk
  CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 230));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_weight_chk;
ALTER TABLE public.users ADD CONSTRAINT users_weight_chk
  CHECK (weight_kg IS NULL OR (weight_kg BETWEEN 30 AND 200));
