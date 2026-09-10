# Check-in Context Chip Picker + Connection Question — Design

**Date:** 2026-09-10
**Status:** Approved by product owner (Paul).

## Background

`docs/research/2026-09-10-checkin-question-quality-research.md` identified two of the highest-value, lowest-cost additions to the wellbeing check-in: a non-scored "context router" (what's actually driving a low score, making it routable to the right staff member) and a new scored item for social connection — the one domain both research reports flagged as a genuine, currently-uncovered gap for this population. Sequenced after (and dependent on) `docs/superpowers/specs/2026-09-10-wellbeing-detection-gaps-design.md`, which fixed the two pipeline gaps the research explicitly warned would make a new flag-eligible item "a third broken flag" if left unfixed.

## Goal

Add the context chip picker and the `connection` question to the check-in, exactly as researched, without expanding scope to the rest of the research's bundled recommendation.

## Non-goals

- **No free-text consolidation.** The research designed the chip picker + connection question alongside replacing 5 per-question note boxes with 1 conditional box (a net reduction in fields). That's explicitly not part of this pass (product-owner decision) — the existing 5 per-question note textareas become 6 (one per question, connection included), unchanged in mechanism.
- **`connection` is not flag-eligible.** Deliberately excluded from `RED_FLAG_KEYS` — observation-only until there's enough real data to know it isn't just adding noise to staff alerts, per the research's own caution (measurement error on a 5-point scale) and product-owner decision. Revisit as a separate, later decision — not a fixed date, since the research didn't specify one either.
- **No rename of `stress` to `calm`.** The research bundled this too (removing the last reverse-worded item), but it's out of scope here — `stress`'s polarity was already fixed via `normalizedScore` in an earlier pass; renaming the item itself is a separate, bigger decision (historical data implications) not part of this spec.
- **No change to the student trend view, the two detection-gap fixes, or any AI chat logic** — all already shipped, untouched here.

## Architecture

### 1. `supabase/migrations/065_wellbeing_context_tags.sql` (new)

```sql
alter table public.wellbeing_surveys
  add column if not exists context_tags text[];

alter table public.wellbeing_surveys
  add constraint wellbeing_surveys_context_tags_valid
  check (
    context_tags is null
    or (
      array_length(context_tags, 1) <= 2
      and context_tags <@ ARRAY['football', 'college', 'home', 'friends', 'money', 'health', 'something_else', 'nothing_much']::text[]
    )
  );
```

Nullable, additive, no backfill (existing rows get `null`, meaning "no chip data" — distinguishable from "explicitly picked nothing," which this spec does not attempt to distinguish; see Open Questions).

### 2. `lib/wellbeing/wellbeingUtils.ts` (modified)

- Add to `SURVEY_QUESTIONS`, after `stress` and before `football_enjoyment` (matching the research's proposed ordering — connection sits with the other "how are you" items, football enjoyment stays last as the sport-specific closer):
  ```ts
  { key: 'connection', label: 'How connected have you felt to people around you?', emoji: '🤝' },
  ```
- New `CONNECTION_SCORE_LABELS = ['', 'Not at all', 'A little', 'Fairly', 'Very', 'Completely']` (distinct from both `GENERIC_SCORE_LABELS` and `STRESS_SCORE_LABELS` — matches the research's exact proposed wording). `getScoreLabel` gains a third branch for `key === 'connection'`.
- `RED_FLAG_KEYS` **unchanged** — `connection` deliberately not added.
- `CONTEXT_TAGS` — new exported const array of the 8 `{ key, label, emoji }` tag definitions (single source of truth shared by the student page's picker UI and the admin page's badge display), matching the migration's allowed values exactly:
  ```ts
  export const CONTEXT_TAGS = [
    { key: 'football',       label: 'Football',        emoji: '⚽' },
    { key: 'college',        label: 'College work',    emoji: '📚' },
    { key: 'home',           label: 'Home',             emoji: '🏠' },
    { key: 'friends',        label: 'Friends',          emoji: '👥' },
    { key: 'money',          label: 'Money',             emoji: '💷' },
    { key: 'health',         label: 'Health or injury', emoji: '🩹' },
    { key: 'something_else', label: 'Something else',   emoji: '🤔' },
    { key: 'nothing_much',   label: 'Nothing much',     emoji: '🙂' },
  ] as const
  ```
- No change to `normalizedScore` (connection is positively worded, not inverted) or `buildWellbeingTrend` (already averages whatever responses a survey has — a 5-question historical survey and a 6-question new one both produce a correct per-survey average; the trend line mixes them without needing special handling, since each point stands on its own survey's average, not a fixed-denominator sum).

### 3. `app/(student)/wellbeing/page.tsx` (modified)

- Header subtitle: "Takes about 60 seconds · Every week" → "Takes about 90 seconds · Every week" (honest estimate — 6 scored questions + the chip screen, not a fabricated precise figure).
- The existing `step` state now ranges `0..SURVEY_QUESTIONS.length` inclusive (0-6): steps `0..5` are the scored questions (unchanged rendering, just one more of them since `connection` is now in `SURVEY_QUESTIONS`), step `6` is the new chip-picker screen.
- Chip-picker screen: renders `CONTEXT_TAGS` as tappable chips, multi-select up to 2 (a 3rd tap when 2 are already selected is a no-op or requires deselecting one first — implementer's choice on exact interaction, the max-2 rule itself is not optional). No chip selected is valid (equivalent to "skip"). "Back" returns to the last scored question; the primary button here is "Submit ✓" (calls the existing `handleSubmit`, extended to send `context_tags`).
- `handleSubmit` sends `context_tags: selectedTags` alongside the existing `answers`/`notes` body.

### 4. `app/api/wellbeing/submit/route.ts` (modified)

- Accepts `context_tags` in the request body (optional, `string[]`).
- Validates: every element is one of the 8 valid keys, and the array has at most 2 elements — reject with 400 otherwise (mirrors the existing `validateSurveyAnswers` gate style; a malformed request from a non-standard client shouldn't silently corrupt a row the DB constraint would also catch, but a clean 400 is better than a raw constraint-violation 500).
- Includes `context_tags` in the same `wellbeing_surveys` update call that already sets `status: 'completed'` / `completed_at`.

### 5. `app/(admin)/admin/wellbeing/page.tsx` (modified)

- Query gains `context_tags` on the `wellbeing_surveys` select.
- New small badge row (near the existing notes block) rendering each selected tag's emoji + label via `CONTEXT_TAGS`, shown only when `context_tags` is non-null and non-empty.
- No change to red-flag/scoring logic — `connection`'s score renders in the existing per-question grid automatically (it's just another `SURVEY_QUESTIONS` entry), colored the same way every other non-flag-eligible question already is (energy/sleep/enjoyment aren't flag-eligible either, and already get the same score-based color treatment).

## Data flow

```
Student completes 6 scored questions (mood, sleep, energy, stress, connection, football_enjoyment)
  → chip-picker screen (0-2 tags, or none)
  → Submit
  → POST /api/wellbeing/submit { survey_id, answers (6 keys), notes, context_tags }
      → validate answers (existing) + context_tags (new: valid keys, max 2)
      → insert wellbeing_responses (6 rows, unchanged mechanism)
      → update wellbeing_surveys: status=completed, completed_at, context_tags (new)
      → existing red-flag check on answers (mood, stress only — connection excluded)
  → admin/wellbeing shows the 6-question grid + tag badges
```

## Testing

- `wellbeingUtils.test.ts`: `getScoreLabel('connection', ...)` returns the new label set; `getRedFlags` with a low `connection` score does **not** flag (the key regression guard for "observation-only"); `CONTEXT_TAGS` exports exactly 8 entries matching the migration's allowed set (a drift guard — if one list changes without the other, this test catches it).
- `submitRoute.test.ts` (existing file, extend): valid `context_tags` (0, 1, 2 tags) accepted and saved; more than 2 tags or an unrecognized tag value rejected with 400; `answers` now requires 6 keys (the existing valid-answers fixture in this test file needs `connection` added, or it will start failing `validateSurveyAnswers` — check and fix while making this change, don't let an unrelated fixture silently start failing).
- Student page test additions (check for an existing test file first — `WellbeingPage.test.tsx` exists from the trend-view work): the chip-picker screen renders after the last scored question; selecting a 3rd tag when 2 are already selected doesn't result in 3 selected; submitting with zero tags succeeds (skip path); the header shows "90 seconds".
- Admin page: check for an existing test file first (none is known to exist for this page as of this spec) — if none exists, a full test is not required for this change alone (matches this repo's established pattern of not requiring net-new test scaffolding for a Server Component admin page with no precedent), but the badge-rendering logic should at minimum be manually verified working during implementation.

## Open questions for the product owner

1. **`context_tags IS NULL` vs. an explicit empty array for "skipped."** This spec doesn't distinguish "student never got the new picker (old survey)" from "student saw it and chose nothing." Both currently produce `null` if the client sends nothing, or could produce `[]` if it sends an empty array. Not consequential for this feature (no logic branches on the distinction today), but worth knowing if a future feature wants to measure "how many students actively skip" versus "how many surveys predate this feature."
2. **When to revisit the observation-only decision on `connection`.** No fixed date is set here. Decide later, once there's a real term's worth of data, whether to promote it into `RED_FLAG_KEYS`.
