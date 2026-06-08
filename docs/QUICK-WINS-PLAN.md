# Tranmere Tracker — Quick Wins Build Plan

> Built from the coach + head of education feedback audit (June 2026).
> The expensive plumbing is done (auth, attendance/GPS/NFC, messaging, push,
> parent portal, Moodle LTI, AI report engine, coursework, 6 live crons).
> These three quick wins are the highest coach-value, lowest-effort gaps.

## Context the new chat needs

- **Stack**: Next.js 14 App Router, TypeScript, Tailwind, Supabase SSR (`@supabase/ssr`), Recharts, Anthropic Claude API, Vercel cron.
- **Supabase project**: `tranmeretracker` (ref `avpdwutgtsurddvfxhmh`).
- **Roles in `public.users`**: `student`, `admin` (head coach Chaid W = admin). Trigger `handle_new_user` auto-creates the profile row from auth metadata, default role `student`.
- **Migrations** run to `022_add_parent_teacher_roles.sql` — next is `023_`.
- **Rules**: every new cron route MUST be added to `vercel.json` in the same commit. Cron schedules are UTC (BST = UTC-1h). Use `.maybeSingle()` for lookups that may return no row. AI calls use prompt caching. New features need Jest tests in `__tests__/`.
- **AI report engine already exists**: `app/api/ai/player-report`, `ai/student-insights`, `ai/match-report`. Reuse these patterns for the learner review summary.

---

## Quick Win 1 — Bi-weekly Wellbeing Survey

**Why first**: self-contained, no third-party integration, direct safeguarding/pastoral value.

**Scope (MVP)**
- Migration `023_wellbeing.sql`: tables `wellbeing_surveys` (id, student_id, sent_at, completed_at, status) and `wellbeing_responses` (survey_id, question_key, score 1-5, note). RLS: students see/write own; admins read all.
- 5-question survey (mood, sleep, energy, stress, football enjoyment) — 1-5 scale + optional note. Keep it 60 seconds.
- Student UI: `app/(student)/wellbeing/page.tsx` — card on dashboard when a survey is open + not completed (mirror the attendance check-in pattern in `StudentPlanner.tsx`).
- Cron `app/api/cron/wellbeing-survey/route.ts` — runs every **2nd Monday** (cron can't do fortnightly natively → run every Monday, gate in code on ISO-week parity). Creates a survey row per active student + push notification. Add to `vercel.json`.
- Admin view: `app/(admin)/admin/wellbeing/page.tsx` — table of latest scores, red-flag any low score (e.g. ≤2 on mood/stress) for follow-up.

**Effort**: small. ~1 migration, 2 pages, 1 cron, 1 alert rule.

---

## Quick Win 2 — Learner Reviews / Termly 1-to-1s

**Why**: the AI engine is already built — this is mostly workflow + structured prompt + PDF.

**Scope (MVP)**
- Migration `024_learner_reviews.sql`: `learner_reviews` (id, student_id, term, scheduled_for, status, ai_summary jsonb, actions jsonb, completed_at, reviewer_id) and `review_answers` (review_id, question_key, answer).
- 10-question learner review form (admin-facing, filled in the 1-to-1).
- Auto-pull attendance + punctuality (already in `daily_attendance`) into the review header.
- AI summary endpoint `app/api/ai/learner-review/route.ts` — reuse `player-report` pattern. Structured output: attendance overview, academic progress, football development, wellbeing (pull from QW1), future aspirations, support needs, agreed actions/targets.
- PDF export: reuse any existing report PDF approach (check `reports/builder`); else `@react-pdf/renderer` or print stylesheet.
- Store previous reviews — list view per student at `app/(admin)/admin/students/[id]` (page already exists, add a Reviews tab).
- Termly scheduling cron (once per term — manual trigger acceptable for MVP; full automation later).

**Effort**: medium. Reuses AI + attendance data heavily.

---

## Quick Win 3 — Student Drill-down Charts (bar / pie)

**Why**: coach explicitly asked; Recharts already in the stack and used admin-side.

**Scope (MVP)**
- Student dashboard: add bar chart (attendance % over term, GPS distance trend) and pie chart (academic progress — units complete vs in-progress vs not started).
- Click a segment → drill into detail view (e.g. click "attendance" → per-session breakdown; click an academic slice → unit list).
- Reuse data already in `daily_attendance`, `gps_sessions`, coursework/`courses` tables. No new backend needed beyond read queries.
- Component: `components/charts/` — keep reusable (`AttendanceBar.tsx`, `AcademicPie.tsx`) with a shared drill-down modal.

**Effort**: small-medium. Pure frontend + read queries.

---

## Suggested build order

1. **QW3 charts** — fastest, visible, no new schema, demos well to the coach.
2. **QW1 wellbeing** — self-contained, high pastoral value.
3. **QW2 learner reviews** — biggest, but reuses everything from QW1 (wellbeing data) + AI engine.

## Definition of done (per win)
- Migration applied + RLS correct
- Page(s) built, mobile-first (PWA is primary surface)
- Jest tests in `__tests__/`
- Cron (if any) added to `vercel.json` same commit, UTC verified
- Deployed to Vercel, smoke-tested on the live PWA

## NOT in quick wins (separate projects — integrations)
VEO, live Catapult API, GURU, MyConcern/safeguarding, Google email, Sports Session Planner, IDPs, digital portfolio, hydration/gym tracking. Each is its own scoped piece.
