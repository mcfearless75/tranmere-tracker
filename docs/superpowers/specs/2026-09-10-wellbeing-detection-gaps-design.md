# Wellbeing Detection Gaps — Design

**Date:** 2026-09-10
**Status:** Approved by product owner (Paul).

## Background

Two research reports tonight (`docs/research/2026-09-09-checkin-safeguarding-research.md`'s "Tier 0" list, and `docs/research/2026-09-10-checkin-question-quality-research.md`) independently identified two still-unfixed detection-integrity gaps, and the newer report explicitly warns that building the chip-picker + social-connection question on top of them "produces a third broken flag." Both were confirmed live by direct code inspection (not just trusting the reports) before this spec was written. This spec fixes both, as a deliberate prerequisite to the check-in enrichment work, not a bundled feature.

## Goal

Close both gaps so the wellbeing detection pipeline is trustworthy before adding a new flag-eligible item on top of it.

## Non-goals

- No coach-facing replacement signal for the visibility lock — explicitly deferred as a separate future feature (product-owner decision). The lock removes coach/teacher access to raw wellbeing data with nothing put in its place for now.
- No change to the chip-picker/connection-question work itself — that's a separate spec, sequenced after this one.
- No change to `getRedFlags`, `normalizedScore`, or any other already-fixed Tier 0 item from tonight's earlier work.

## Architecture

### 1. `components/admin/safeguarding/ConcernList.tsx` (modified) — category-aware masking

**Confirmed live bug** (read directly, not just from the report): `openStudentIds` is built from `concerns.filter(c => c.status !== 'closed')` with no category filter (`ConcernList.tsx:43-46`) — a student with *any* open concern of *any* category (attendance, behaviour, online, other) has every new wellbeing-flag suggestion suppressed indefinitely, regardless of relevance.

Fix: filter to `c.status !== 'closed' && c.category === 'wellbeing'`. Every `SuggestedConcern` this component ever receives is already wellbeing-sourced (its one caller, `app/(admin)/admin/safeguarding/page.tsx`, builds `suggestions` from `getRedFlags(wellbeing_responses)` — nothing else feeds this prop), so this is a correct, not partial, fix for the actual current usage, not a workaround pending a future category field on `SuggestedConcern`.

### 2. `app/(admin)/admin/wellbeing/page.tsx` (modified) — lock to admin (DSL) only

**Confirmed live gap** (read directly): the page checks only `if (!user) redirect('/admin-login')` — no role check. Middleware (`middleware.ts:178-179`) already blocks any non-staff (student/parent) from all of `/admin/*`, so this is not a full access-control hole, but any of admin/coach/teacher can currently see raw wellbeing scores and (since tonight's earlier notes-visibility fix) free-text notes — the same audience as every other staff-wide admin page, when the research ties coach-visible scores directly to students under-reporting.

Fix: add the exact guard `/admin/safeguarding/page.tsx` already uses —
```ts
const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
if (!profile || profile.role !== 'admin') redirect('/admin/dashboard')
```

**Deliberate consequence, not a bug:** coaches and teachers lose access to this page entirely, with no replacement signal. The research explicitly flags this as a real trade-off (coach engagement is cited as the single biggest lever on honest completion) — accepted here as a known, temporary state, not solved in this pass.

## Data flow

No new data flow — both fixes narrow existing read paths (a suggestion-filtering predicate, a page-level role guard). No schema, migration, or RLS change.

## Testing

- `__tests__/components/ConcernList.test.tsx` — this file already exists. Its existing test "hides a suggestion when the student already has an active concern" (line 72) already uses a `category: 'wellbeing'` concern (the `makeConcern` helper's default) — it stays correct and passing under the fix unchanged, since that's exactly the case that should still suppress. Add one new test: a suggestion for a student whose *only* open concern has a *different* category (e.g. `attendance`) must still appear — this is the actual regression guard for the bug fix, and does not exist today.
- `app/(admin)/admin/wellbeing/page.tsx`: no existing test (confirmed by direct search). Given this repo's established convention of testing route handlers directly but no precedent found for testing a Server Component admin page like this, and the change being a two-line guard identical in shape to the already-shipped, unmodified `/admin/safeguarding` guard — this task does not require a new dedicated test file. State this explicitly rather than silently skipping coverage.
