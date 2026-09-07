-- ============================================================================
-- 060_safeguarding_dedup_and_unique_constraint.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- attendance-safeguarding-check's per-student dedup was a plain SELECT
-- ("already raised today?") with no DB-level uniqueness behind it — the
-- exact same class of bug just fixed in missed-checkin-sweep (054...052...
-- see commit 354bff8): two overlapping cron invocations can both pass the
-- upfront check before either has inserted, and both then successfully
-- insert (safeguarding_concerns has no constraint to make the second one
-- fail), producing a duplicate case. Confirmed this ALREADY happened live:
--   • 33 students each got exactly 2 duplicate auto-raised 'attendance'
--     concerns today, 2026-09-07 (14:00:3x and 14:15:3x — a normal
--     15-minute-apart pair of overlapping cron ticks, not just a
--     millisecond race).
--   • One student (Caleb McWilliam) has 19 duplicates from 2026-08-20,
--     15:15 through 19:45 — the dedup SELECT was failing on every single
--     15-minute tick that evening, not just occasionally racing.
-- All duplicates confirmed safe to clean up before verified: every one has
-- status = 'open' (never touched) and zero safeguarding_notes — nobody has
-- done any casework on any of them.
--
-- Fix:
--   a. Add a raised_date column (explicit London-calendar date, set by the
--      route — not derived from created_at, so it's exact regardless of
--      exec time near a UTC/BST midnight boundary).
--   b. Backfill it for existing system-raised rows from created_at.
--   c. Deduplicate: keep the earliest row per (student_id, category,
--      raised_date) among system-raised (raised_by IS NULL) rows, delete
--      the rest. Manually staff-raised concerns (raised_by IS NOT NULL)
--      are never touched by this — a real second concern raised by a human
--      on the same day is legitimate and must survive.
--   d. Add a partial UNIQUE index enforcing one system-raised concern per
--      (student, category, day) going forward — the real race guard. The
--      route (separate commit) now checks the insert's error instead of
--      trusting the upfront SELECT alone.
--
-- Idempotent: safe to re-run (dedup is a no-op once already deduped; the
-- index creation is IF NOT EXISTS).
-- ============================================================================

ALTER TABLE public.safeguarding_concerns ADD COLUMN IF NOT EXISTS raised_date date;

UPDATE public.safeguarding_concerns
SET raised_date = (created_at AT TIME ZONE 'Europe/London')::date
WHERE raised_by IS NULL AND raised_date IS NULL;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY student_id, category, raised_date
           ORDER BY created_at ASC
         ) AS rn
  FROM public.safeguarding_concerns
  WHERE raised_by IS NULL
)
DELETE FROM public.safeguarding_concerns
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS safeguarding_concerns_one_auto_per_day
  ON public.safeguarding_concerns (student_id, category, raised_date)
  WHERE raised_by IS NULL;

-- ── Verification (run after applying) ───────────────────────────────────────
-- SELECT student_id, category, raised_date, count(*)
-- FROM safeguarding_concerns WHERE raised_by IS NULL
-- GROUP BY student_id, category, raised_date HAVING count(*) > 1;
-- Expect: 0 rows.
