-- ============================================================================
-- 065_wellbeing_context_tags.sql
-- Run in Supabase Dashboard → SQL Editor (or via the Supabase MCP apply_migration tool)
--
-- Adds the "what's been on your mind" context picker to the wellbeing
-- check-in — a non-scored, never-flag-eligible field that makes a low score
-- routable (coursework → tutor, home → DSL, health → physio) instead of an
-- unroutable bare number. See docs/research/2026-09-10-checkin-question-quality-research.md.
--
-- Nullable and additive: existing rows get NULL (no chip data — this
-- predates the feature, not "explicitly picked nothing"). No backfill.
-- ============================================================================

ALTER TABLE public.wellbeing_surveys
  ADD COLUMN IF NOT EXISTS context_tags text[];

ALTER TABLE public.wellbeing_surveys
  ADD CONSTRAINT wellbeing_surveys_context_tags_valid
  CHECK (
    context_tags IS NULL
    OR (
      array_length(context_tags, 1) <= 2
      AND context_tags <@ ARRAY['football', 'college', 'home', 'friends', 'money', 'health', 'something_else', 'nothing_much']::text[]
    )
  );
