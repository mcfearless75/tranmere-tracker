# Tranmere Tracker — Session Handoff

_Last updated: 2026-06-08. Paste the "Kickoff prompt" below into a new chat._

## Current State
- **master @ `6703865`** — pushed, clean working tree.
- **Build: green** — `next build` passes (63 pages, 0 type errors, 0 lint errors).
- **Tests: 301 passing** across 25 suites (`npm test`).
- **All SQL migrations run** in Supabase up to `029_goals.sql`.

## Shipped this session (two multi-agent waves)
**Wave 1 — new feature areas (migrations 027–029):**
- IDP / Individual Development Plans (027) — student + admin pages, API
- Digital Learner Portfolio (028) — entry types, tags, admin view
- Goal Setting w/ deadlines (029) — priority sort, completion rate
- Learning Hub — 18 curated resources, category filter + search (no DB)
- MyConcern signposting page (no DB)
- Academic Alerts cron — Mon–Fri 07:00 UTC (`vercel.json`)
- BottomNav updated: Home, Calendar, Gym, Targets, Wellbeing, Profile

**Wave 2 — gap-fill:**
- Parent push notifications on student check-in/out (NFC + GPS routes)
- Dashboard "My Tools" quick-links grid
- Student academic progress charts (pie + unit bars)
- Student performance summary page (GPS, attendance, matches)
- Meal photo upload UI → AI analysis on nutrition page

**Bug fixed:** dashboard `Promise.all` destructuring was misaligned — wellbeing
survey query (pos 13) mapped to `chartAttended`; `openSurvey` (pos 15) got chart
data, so the wellbeing card checked the wrong data. Reordered + fixed unused
`isScaleQ` that was breaking the Vercel build.

## What's left
**External-API blocked (deferred):** VEO, Catapult, GURU, Moodle API,
Sports Session Planner, Google email access.
**Future (explicitly deferred):** youth football section, bursary management,
recruitment portal.
The platform's own (non-integration) feature set is functionally complete.

## Working rules (project)
- `@supabase/ssr` only; `createClient()` server, `createAdminClient()` service role.
- `.maybeSingle()` for optional rows.
- Every cron route needs a `vercel.json` entry (UTC) in the same commit.
- All new features need Jest tests; TS strict, no `any`.
- After any wave: `npm test` + `npx next build` before pushing.

## Kickoff prompt (paste into new chat)
> Tranmere Tracker. master @ 6703865, build green, 301 tests passing, migrations
> through 029 run. Read docs/SESSION-HANDOFF.md for full state. Today I want to: [TASK].
