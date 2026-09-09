# AI Chat Crisis-Handling Fix — Design

**Date:** 2026-09-09
**Status:** Approved by product owner (Paul), pending implementation plan.

## Background

Research into the wellness check-in/safeguarding pipeline (`docs/research/2026-09-09-checkin-safeguarding-research.md`) flagged that the AI Coach chatbot students talk to directly (`app/api/ai/chat/route.ts`) has no crisis, distress, or safeguarding-handling instruction at all — a repo-wide search for self-harm/suicide/crisis language returns nothing. The bot is a general-purpose Claude Sonnet chat available to minors with a one-line system prompt. This spec fixes that.

## Goals

1. The AI Coach responds appropriately (empathetic, non-diagnosing, points to a real trusted-adult/DSL path and crisis lines) when a student's message shows signs of distress.
2. A human member of staff (the DSL) is reliably notified when a student's message shows signs of distress — **independent of whether the AI's own reply gets it right.** This is the actual safeguarding fix; (1) alone would rely entirely on an LLM's judgment with no deterministic backstop.
3. While in this file: fix a real correctness bug (`.single()` used where a row may legitimately not exist, per this repo's standing rule) and extract a shared dual-channel (web push + native/FCM) staff-notification helper, since the exact same "web-push-only" gap the research also flagged already exists at a second call site (`app/api/wellbeing/submit/route.ts`) and is fixed here as part of the same change.

## Non-goals

- No second LLM classifier call to judge distress (considered, rejected for now — doubles latency/cost per message and is harder to test deterministically than keyword matching; can be layered in later if false negatives from the keyword approach prove to be a real problem).
- No change to how staff *view* AI chat transcripts (a separate, bigger feature the research flagged — out of scope here).
- No change to `attendance-safeguarding-check/route.ts`, which has the same missing-native-push gap — flagged separately, not touched in this change (avoid unrelated scope creep in an unrelated cron route).

## Architecture

### 1. `lib/safeguarding/distressDetection.ts` (new)

```ts
export function detectDistressSignals(text: string): string[]
```

Pure, deterministic, word-boundary-aware keyword/phrase matching across a small set of categories (self-harm/suicidal ideation, abuse disclosure, "don't want to be here" hopelessness phrasing). Returns the matched category labels (empty array = no match). No AI call, no network access — fully unit-testable. Intentionally biased toward false positives over false negatives (a missed real signal is much worse than an occasional unnecessary staff notification).

### 2. `lib/notifications/notifyStaff.ts` (new)

```ts
export async function notifyUsers(
  admin: SupabaseClient,
  userIds: string[],
  notification: { title: string; body: string; url: string }
): Promise<void>
```

Extracted from the dual-channel (web push via `push_subscriptions` + native via `native_push_tokens`/`sendFcmBatch`) pattern already implemented three times (`app/api/push/send/route.ts`, `notifyRoomMembers`, `nudgeRoom` in `app/chat/actions.ts`). Best-effort: swallows its own errors (matches the existing `notifyStaffOfRedFlag` convention — a notification failure must never fail the calling request).

### 3. `app/api/ai/chat/route.ts` (modified)

- Three `.single()` calls (`chat_members` membership check, `chat_rooms` kind check, `users` profile fetch) become `.maybeSingle()`. Today an invalid/stale `roomId` or a race on the membership row throws a Postgres error and 500s instead of returning the intended 403/400.
- After loading `claudeMessages` and confirming the latest message is from the student, run `detectDistressSignals` on that message's raw text.
- On a match, **in parallel with the Claude call** (not blocking or gating it):
  - Upfront cheap check: does an auto-raised (`raised_by IS NULL`) `wellbeing`-category concern already exist for this student today? If so, skip (already handled today).
  - Insert a `safeguarding_concerns` row: `category: 'wellbeing'`, `severity: 'high'`, `raised_by: null`, `raised_date: londonDateISO(now)`, `status: 'open'`, description referencing that it was detected in an AI Coach conversation (no raw student message text stored in the description — see Privacy below). Race-guarded by the existing partial unique index (`safeguarding_concerns_one_auto_per_day`, migration 060) exactly like `attendance-safeguarding-check`: an insert error with code `23505` means another concurrent request already raised it, and is treated as success, not failure.
  - On successful insert, notify the DSL (admin role only — safeguarding cases are admin-only casework, same convention as `attendance-safeguarding-check`) via `notifyUsers`.
- System prompt gains explicit distress-response instructions: respond with empathy, never attempt to diagnose or "handle" it alone, always name a real next step (talk to a coach/teacher/trusted adult) plus Childline (0800 1111) and Samaritans (116 123) for the student's own reference, and 999 for immediate danger. Ordinary (non-crisis) conversation is explicitly unaffected — this is additive guidance, not a tone change for the whole bot.

### 4. `app/api/wellbeing/submit/route.ts` (modified)

`notifyStaffOfRedFlag` currently calls `sendPushNotificationToUser` (web push only). Swapped to use the new `notifyUsers` helper so staff on the native app also receive wellbeing red-flag pushes — fixes the gap noted in prior session memory, using the exact helper this change already introduces.

## Data flow

```
Student sends message
  → saved to chat_messages
  → route loads recent history
  → detectDistressSignals(latest student message)
        │
        ├─ no match → (nothing extra)
        │
        └─ match → [in parallel, best-effort, never blocks the reply]
              upfront dedup check (today, category=wellbeing, raised_by IS NULL)
                → already exists? skip
                → else insert safeguarding_concerns (race-guarded by unique index)
                    → success (or 23505 = someone else just won the race) → notifyUsers(DSL)
  → Claude call with updated system prompt (always happens, regardless of the above)
  → bot reply saved to chat_messages
  → response returned
```

A distressed student still receives a normal, supportive AI reply either way — the escalation path is a silent parallel safety net for staff, not a gate on the conversation.

## Privacy note

The auto-raised concern's `description` field references that a concerning message was detected in an AI Coach conversation — it does **not** copy the student's raw message text into the safeguarding_concerns table.

**Correction made during final review (2026-09-09):** this section originally assumed staff could follow a link to open the chat thread itself, on the premise that "chat rooms are already admin-visible per existing chat schema." That premise is wrong — a bot room's `chat_members` only ever contains the student and the bot, so a DSL opening `/chat/<roomId>` hits the same membership gate any other non-member would ("You're not a member of this conversation"). The shipped notification instead points staff at `/admin/safeguarding` (the existing case-management page) and the description explicitly tells them to check in with the student directly, rather than implying a transcript they can't actually reach. Net effect: staff get a category label and a name, not the message text or a route to it — follow-up depends on speaking to the student. Giving the DSL real read access to bot-room conversations (or including a bounded excerpt in the concern) is a separate product decision, not made here.

## Error handling

- The distress-check → insert → notify path is entirely best-effort: any error is logged (`console.error`) and swallowed, never thrown — matches the existing `notifyStaffOfRedFlag` "never let notification failures affect the submission" convention, and ensures a detector bug can never break the chat feature itself.
- `23505` (unique violation) from the concern insert is the expected race outcome, not an error — logged only if the code is something else.

## Testing

- `lib/safeguarding/distressDetection.test.ts`: positive matches per category, negative/boundary cases (e.g. "killing it in training" must not match "kill"), empty/whitespace input.
- `lib/notifications/notifyStaff.test.ts`: mocked Supabase admin client + `sendPushNotification`/`sendFcmBatch` — sends to both channels, handles empty subscriber lists, swallows send errors.
- `app/api/ai/chat/route.ts` test additions: invalid `roomId` now returns 403/400 not 500 (the `.maybeSingle()` fix); a distress-matching message triggers exactly one concern insert + one notify call; a second matching message the same day does not raise a duplicate (dedup); a non-matching message raises nothing; the AI reply is generated and saved in both cases.
- `app/api/wellbeing/submit/route.ts` existing tests updated to assert `notifyUsers` is called instead of the old single-channel function.
