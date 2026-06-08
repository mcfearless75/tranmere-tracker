# Tranmere Tracker — Session Handoff

_Last updated: 2026-06-08. Paste the "Kickoff prompt" below into a new chat._

## Current State
- **master @ `e69f826`** — pushed, clean working tree.
- **Build: green** — `next build` passes (0 type errors, 0 lint errors, 4 pre-existing warnings).
- **Tests: 366 passing** across 35 suites (`npm test`).
- **Migrations run in Supabase up to `029_goals.sql`.**
  ⚠️ **`030_safeguarding.sql` and `031_integrations.sql` are committed but NOT yet run.**
  Run both in the Supabase SQL editor — until then `/admin/safeguarding` and
  `/admin/integrations` show a "migration needed" notice (no crash).

## Shipped 2026-06-08 (multi-agent gap-fill wave, commit `e69f826`)
- **Safeguarding workflow** — concerns + notes, status/severity, red-flag surfacing from wellbeing (migration 030). Admin nav added.
- **Integration scaffolding** — typed adapter registry + masked admin config UI for Moodle/VEO/Catapult/GURU/Sports Session Planner (migration 031). Secrets service-role only, never sent to client. Admin nav added. Drop real vendor calls into the marked TODO blocks once creds exist — no signature changes.
- **VEO + Catapult** student access pages (pending credentials), wired into dashboard "My Tools".
- **Parent announcements feed** — reuses existing broadcast data (no new table), added to both parent navs.
- **Meal photo upload** — client-side validation + compression before the AI route.
- Jest: added a `fetch` stub in `jest.setup.ts` (plain fn, build-safe) and `@jest-environment node` for the route-handler test.

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
**Credential-gated (scaffolding now built — paste keys into `/admin/integrations`):**
VEO, Catapult, GURU, Moodle REST sync, Sports Session Planner. Each adapter
throws "not configured" until its key is saved + provider enabled. Google email
access still needs an OAuth client.
Needed: Moodle WS token, VEO API key, Catapult API token + org ID, GURU key, SSP key, Google OAuth client.
**Future (explicitly deferred):** youth football section, bursary management,
recruitment portal.
The platform's own (non-integration) feature set is functionally complete; the
remaining integrations are gated on third-party credentials, not code.

## Working rules (project)
- `@supabase/ssr` only; `createClient()` server, `createAdminClient()` service role.
- `.maybeSingle()` for optional rows.
- Every cron route needs a `vercel.json` entry (UTC) in the same commit.
- All new features need Jest tests; TS strict, no `any`.
- After any wave: `npm test` + `npx next build` before pushing.

## Kickoff prompt (paste into new chat)
> Tranmere Tracker. master @ e69f826, build green, 366 tests passing, migrations
> through 029 run (030/031 committed, awaiting run). Read docs/SESSION-HANDOFF.md
> for full state. Today I want to: [TASK].
