# AI Chat Crisis-Handling Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the AI Coach chatbot (`app/api/ai/chat/route.ts`) a deterministic safeguarding safety net — a message showing signs of distress reliably raises a staff-visible case regardless of what the AI itself replies — plus crisis-aware reply guidance, and fix two related bugs found in the same area.

**Architecture:** Two small, independently-testable pure/mockable `lib/` helpers (`detectDistressSignals`, `notifyUsers`) plus one orchestrating helper (`autoRaiseConcern`) that composes them with the existing `safeguarding_concerns` race-safe insert pattern. The two API routes become thin callers of these helpers — consistent with this repo's existing convention (see `__tests__/lib/safeguarding/notesRoute.test.ts`) of testing route handlers directly via mocked Supabase clients rather than leaving routes untested.

**Tech Stack:** Next.js 14 App Router route handlers, Supabase (service-role admin client for cross-user reads/writes), Jest (`node` test environment for route/lib tests that need `Request`/`NextRequest`), TypeScript strict.

## Global Constraints

- Use `.maybeSingle()` for any Supabase lookup that may legitimately return no row; `.single()` is only correct when the row is guaranteed to exist. (`CLAUDE.md`)
- All new features need Jest tests in `__tests__/`. (`CLAUDE.md`)
- TypeScript strict — no `any` types without justification. (`CLAUDE.md`) — test fixture objects that intentionally only implement the subset of `SupabaseClient` a function actually calls are cast with `as unknown as SupabaseClient`, justified inline as "test double, not a full client."
- Claude API calls must include prompt caching where applicable. (`CLAUDE.md`) — **explicitly deferred**: the chat route's system prompt already embeds a per-student name today (pre-existing, not introduced by this plan), so it isn't a cache-stable block; adding real prompt caching here would mean restructuring the prompt into static/variable parts, which is a separate, unrelated piece of work. Not done in this plan — flag as a follow-up after this merges, do not silently fold it in.
- Every new cron route must be added to `vercel.json` in the same commit — not applicable, this plan adds no cron routes.
- `raised_by: null` + `raised_date` (Europe/London calendar date) is how every existing system-raised `safeguarding_concerns` row is written, race-guarded by the partial unique index `safeguarding_concerns_one_auto_per_day` (`supabase/migrations/060_safeguarding_dedup_and_unique_constraint.sql`). This plan's new auto-raised concern reuses that existing index — no new migration needed.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/safeguarding/distressDetection.ts` (new) | Pure function: does this raw message text match a distress signal category? No I/O. |
| `__tests__/lib/safeguarding/distressDetection.test.ts` (new) | Unit tests for the above. |
| `lib/notifications/notifyStaff.ts` (new) | `notifyUsers(admin, userIds, notification)` — dual-channel (web push + FCM) push to an explicit list of user ids. Extracted from the pattern already independently implemented in `app/api/push/send/route.ts`, `notifyRoomMembers`, and `nudgeRoom`; those three existing call sites are untouched by this plan. |
| `__tests__/lib/notifications/notifyStaff.test.ts` (new) | Unit tests for the above. |
| `lib/safeguarding/autoRaiseConcern.ts` (new) | `autoRaiseConcern(admin, params)` — race-safe auto-raise of a `safeguarding_concerns` case (mirrors the exact pattern in `app/api/cron/attendance-safeguarding-check/route.ts`) + DSL (admin-role) notification via `notifyUsers`. Best-effort, never throws. |
| `__tests__/lib/safeguarding/autoRaiseConcern.test.ts` (new) | Unit tests for the above. |
| `app/api/wellbeing/submit/route.ts` (modified) | `notifyStaffOfRedFlag` now calls `notifyUsers` instead of looping `sendPushNotificationToUser` — fixes a missing-native-push gap as a side effect of reusing the new shared helper. |
| `__tests__/lib/wellbeing/submitRoute.test.ts` (new) | Route-level tests focused on the changed notify wiring, plus minimal smoke coverage of the surrounding auth/success flow. |
| `app/api/ai/chat/route.ts` (modified) | Three `.single()` → `.maybeSingle()` fixes; runs `detectDistressSignals` on the latest student message and, on a match, calls `autoRaiseConcern` in parallel with (never blocking or gating) the normal AI reply; system prompt gains crisis-response instructions. |
| `__tests__/lib/ai/chatRoute.test.ts` (new) | Route-level tests: auth/membership/room-kind checks now return clean errors instead of throwing; ordinary messages don't escalate; distress-matching messages both reply normally AND escalate; system prompt contains the new guidance. |

---

## Task 1: Distress signal detection (pure function)

**Files:**
- Create: `lib/safeguarding/distressDetection.ts`
- Test: `__tests__/lib/safeguarding/distressDetection.test.ts`

**Interfaces:**
- Produces: `detectDistressSignals(text: string): string[]` — returns matched category keys (`'self_harm_or_suicide' | 'abuse_disclosure' | 'hopelessness'`), empty array if no match. Case-insensitive. Deliberately biased toward false positives over false negatives.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/safeguarding/distressDetection.test.ts`:

```ts
import { detectDistressSignals } from '@/lib/safeguarding/distressDetection'

describe('detectDistressSignals', () => {
  it('returns an empty array for ordinary messages', () => {
    expect(detectDistressSignals('I feel a bit stressed about exams')).toEqual([])
  })

  it('returns an empty array for empty/whitespace input', () => {
    expect(detectDistressSignals('')).toEqual([])
    expect(detectDistressSignals('   ')).toEqual([])
  })

  it('does NOT match unrelated uses of the word "kill" (word-boundary check)', () => {
    expect(detectDistressSignals('I was killing it in training today!')).toEqual([])
  })

  it('matches self-harm/suicide phrasing', () => {
    expect(detectDistressSignals("I've been thinking about killing myself")).toEqual(['self_harm_or_suicide'])
    expect(detectDistressSignals('I want to end my life')).toEqual(['self_harm_or_suicide'])
    expect(detectDistressSignals("I don't want to be here anymore")).toEqual(['self_harm_or_suicide'])
  })

  it('is case-insensitive', () => {
    expect(detectDistressSignals('I WANT TO END MY LIFE')).toEqual(['self_harm_or_suicide'])
  })

  it('matches abuse disclosure phrasing', () => {
    expect(detectDistressSignals('he hits me at home')).toEqual(['abuse_disclosure'])
    expect(detectDistressSignals("someone is hurting me and I don't know what to do")).toEqual(['abuse_disclosure'])
  })

  it('matches hopelessness phrasing', () => {
    expect(detectDistressSignals("nothing matters anymore, I've given up on everything")).toEqual(['hopelessness'])
  })

  it('returns multiple categories when a message matches more than one', () => {
    const result = detectDistressSignals('I want to end my life, nothing matters anymore')
    expect(result).toEqual(['self_harm_or_suicide', 'hopelessness'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest distressDetection -v`
Expected: FAIL with "Cannot find module '@/lib/safeguarding/distressDetection'"

- [ ] **Step 3: Write the implementation**

Create `lib/safeguarding/distressDetection.ts`:

```ts
/**
 * Deterministic, keyword/phrase-based distress detector for student-facing
 * chat messages. This is a safety NET, not a diagnosis: it runs regardless
 * of what an LLM decides to do with the same message, so a human is
 * notified even if the AI's own reply is imperfect. Deliberately biased
 * toward false positives over false negatives — an unnecessary staff
 * notification is a much smaller cost than a missed real signal.
 *
 * Pure and synchronous: no AI call, no network access, fully unit-testable.
 */

type DistressCategory = 'self_harm_or_suicide' | 'abuse_disclosure' | 'hopelessness'

const PATTERNS: Record<DistressCategory, RegExp> = {
  self_harm_or_suicide:
    /\b(kill(?:ing)?\s+myself|end(?:ing)?\s+my\s+life|suicidal|suicide|self[- ]harm(?:ing)?|hurt(?:ing)?\s+myself|cut(?:ting)?\s+myself|want(?:ed)?\s+to\s+die|don'?t\s+want\s+to\s+(?:be\s+here|live|exist)(?:\s+anymore)?|no\s+reason\s+to\s+live)\b/i,
  abuse_disclosure:
    /\b(?:he|she|they)\s+(?:hit|hurts?|touche?d?|abuses?)\s+me\b|\bsomeone\s+(?:is\s+)?(?:hurting|abusing|hitting)\s+me\b|\b(?:sexually\s+abus\w*|being\s+abused)\b/i,
  hopelessness:
    /\b(?:no\s*one\s+(?:would\s+)?care|nothing\s+matters\s+anymore|can'?t\s+(?:take|cope\s+with|handle)\s+(?:it|this)\s+anymore|given?\s+up\s+on\s+(?:everything|life))\b/i,
}

export function detectDistressSignals(text: string): DistressCategory[] {
  if (!text || !text.trim()) return []

  return (Object.keys(PATTERNS) as DistressCategory[]).filter(category =>
    PATTERNS[category].test(text)
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest distressDetection -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/safeguarding/distressDetection.ts __tests__/lib/safeguarding/distressDetection.test.ts
git commit -m "feat(safeguarding): add deterministic distress-signal detector

Pure keyword/phrase matcher for student chat messages — self-harm/
suicide, abuse disclosure, hopelessness. Runs independently of any LLM
judgment so a human can be notified regardless of what the AI itself
replies. Word-boundary aware (kill(ing) + myself/my life required, not
bare 'kill') to avoid trivial false positives like training banter.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 2: Shared dual-channel staff notification helper

**Files:**
- Create: `lib/notifications/notifyStaff.ts`
- Test: `__tests__/lib/notifications/notifyStaff.test.ts`

**Interfaces:**
- Consumes: `sendPushNotification` from `lib/webpush.ts` (existing, signature `(subscription: {endpoint, p256dh, auth}, payload: {title, body, url?}) => Promise<unknown>`), `sendFcmBatch` from `lib/firebase-admin.ts` (existing, signature `(tokens: string[], notification: {title, body, url?}) => Promise<{sent, failed}>`).
- Produces: `notifyUsers(admin: SupabaseClient, userIds: string[], notification: {title: string; body: string; url: string}): Promise<void>` — used by Task 3 (`autoRaiseConcern`) and Task 4 (wellbeing submit route).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/notifications/notifyStaff.test.ts`:

```ts
/**
 * @jest-environment node
 */
const sendPushNotificationMock = jest.fn(() => Promise.resolve())
const sendFcmBatchMock = jest.fn(() => Promise.resolve({ sent: 0, failed: 0 }))

jest.mock('@/lib/webpush', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotificationMock(...args),
}))
jest.mock('@/lib/firebase-admin', () => ({
  sendFcmBatch: (...args: unknown[]) => sendFcmBatchMock(...args),
}))

import { notifyUsers } from '@/lib/notifications/notifyStaff'

const NOTIFICATION = { title: 'T', body: 'B', url: '/u' }

/** Minimal admin-client double — only implements .from() for the two tables notifyUsers reads. */
function makeAdminMock(opts: {
  webPushSubs?: { endpoint: string; p256dh: string; auth: string }[]
  nativeTokens?: string[]
} = {}) {
  const { webPushSubs = [], nativeTokens = [] } = opts

  const pushSubsIn = jest.fn(() => Promise.resolve({ data: webPushSubs }))
  const pushSubsSelect = jest.fn(() => ({ in: pushSubsIn }))

  const nativeTokensIn = jest.fn(() => Promise.resolve({ data: nativeTokens.map(token => ({ token })) }))
  const nativeTokensSelect = jest.fn(() => ({ in: nativeTokensIn }))

  const from = jest.fn((table: string) => {
    if (table === 'push_subscriptions') return { select: pushSubsSelect }
    if (table === 'native_push_tokens') return { select: nativeTokensSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from }
}

beforeEach(() => {
  sendPushNotificationMock.mockClear()
  sendFcmBatchMock.mockClear()
})

describe('notifyUsers', () => {
  it('does nothing when userIds is empty', async () => {
    const admin = makeAdminMock()
    await notifyUsers(admin as any, [], NOTIFICATION)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('sends both web push and FCM when both kinds of recipients exist', async () => {
    const admin = makeAdminMock({
      webPushSubs: [{ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }],
      nativeTokens: ['fcm-token-1'],
    })
    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).toHaveBeenCalledWith(['fcm-token-1'], NOTIFICATION)
  })

  it('still sends FCM when there are native tokens but no web push subscriptions', async () => {
    const admin = makeAdminMock({ nativeTokens: ['fcm-token-1'] })
    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
    expect(sendFcmBatchMock).toHaveBeenCalledTimes(1)
  })

  it('still sends web push when there are subscriptions but no native tokens', async () => {
    const admin = makeAdminMock({ webPushSubs: [{ endpoint: 'e', p256dh: 'p', auth: 'a' }] })
    await notifyUsers(admin as any, ['user-1'], NOTIFICATION)
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendFcmBatchMock).not.toHaveBeenCalled()
  })

  it('swallows errors and never throws', async () => {
    const admin = { from: jest.fn(() => { throw new Error('boom') }) }
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(notifyUsers(admin as any, ['user-1'], NOTIFICATION)).resolves.toBeUndefined()
    errorSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest notifyStaff -v`
Expected: FAIL with "Cannot find module '@/lib/notifications/notifyStaff'"

- [ ] **Step 3: Write the implementation**

Create `lib/notifications/notifyStaff.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/webpush'
import { sendFcmBatch } from '@/lib/firebase-admin'

export type StaffNotification = { title: string; body: string; url: string }

/**
 * Dual-channel (web push + native/FCM) notification to an explicit list of
 * user ids. Extracted from the pattern already independently implemented in
 * app/api/push/send/route.ts, notifyRoomMembers, and nudgeRoom
 * (app/chat/actions.ts) — those three existing call sites are not touched
 * by this change; this helper is for new/refactored call sites going
 * forward. Best-effort: never throws, matching every other safeguarding
 * notification in this app.
 */
export async function notifyUsers(
  admin: SupabaseClient,
  userIds: string[],
  notification: StaffNotification,
): Promise<void> {
  if (userIds.length === 0) return

  try {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (subs?.length) {
      await Promise.allSettled(
        subs.map(s =>
          sendPushNotification({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, notification)
        )
      )
    }

    const { data: nativeTokens } = await admin
      .from('native_push_tokens')
      .select('token')
      .in('user_id', userIds)

    const tokens = (nativeTokens ?? []).map(r => r.token as string)
    if (tokens.length > 0) {
      await sendFcmBatch(tokens, notification)
    }
  } catch (err) {
    console.error('[notifyUsers] failed:', err)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest notifyStaff -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/notifyStaff.ts __tests__/lib/notifications/notifyStaff.test.ts
git commit -m "feat(notifications): extract shared dual-channel notifyUsers helper

The web-push + FCM dual-delivery pattern already existed three times
independently (app/api/push/send/route.ts, notifyRoomMembers, nudgeRoom)
with no shared implementation. Extracts it as notifyUsers(admin, userIds,
notification) for new call sites — existing call sites are untouched.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 3: Race-safe auto-raised safeguarding concern

**Files:**
- Create: `lib/safeguarding/autoRaiseConcern.ts`
- Test: `__tests__/lib/safeguarding/autoRaiseConcern.test.ts`

**Interfaces:**
- Consumes: `notifyUsers` from Task 2 (`lib/notifications/notifyStaff.ts`), `londonDateISO` from `lib/dates.ts` (existing, `(date?: Date) => string`, `YYYY-MM-DD` in Europe/London), `ConcernCategory`/`ConcernSeverity` types from `lib/safeguarding/safeguardingUtils.ts` (existing).
- Produces: `autoRaiseConcern(admin: SupabaseClient, params: AutoRaiseConcernParams): Promise<{ raised: boolean }>` where
  ```ts
  type AutoRaiseConcernParams = {
    studentId: string
    category: ConcernCategory
    severity: ConcernSeverity
    description: string
    notifyTitle: string
    notifyBody: string
    notifyUrl: string
  }
  ```
  Used by Task 5 (`app/api/ai/chat/route.ts`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/safeguarding/autoRaiseConcern.test.ts`:

```ts
/**
 * @jest-environment node
 */
const notifyUsersMock = jest.fn(() => Promise.resolve())
jest.mock('@/lib/notifications/notifyStaff', () => ({
  notifyUsers: (...args: unknown[]) => notifyUsersMock(...args),
}))

import { autoRaiseConcern } from '@/lib/safeguarding/autoRaiseConcern'

const BASE_PARAMS = {
  studentId: 'student-1',
  category: 'wellbeing' as const,
  severity: 'high' as const,
  description: 'test description',
  notifyTitle: 'Test title',
  notifyBody: 'Test body',
  notifyUrl: '/chat/room-1',
}

/** Minimal admin-client double for the two tables autoRaiseConcern touches. */
function makeAdminMock(opts: {
  alreadyRaisedToday?: boolean
  insertError?: { code: string } | null
  dslIds?: string[]
} = {}) {
  const { alreadyRaisedToday = false, insertError = null, dslIds = ['dsl-1'] } = opts

  // Upfront dedup check: .select('id').eq().eq().eq().is().limit().maybeSingle()
  const checkMaybeSingle = jest.fn(() =>
    Promise.resolve({ data: alreadyRaisedToday ? { id: 'existing-concern' } : null })
  )
  const checkLimit = jest.fn(() => ({ maybeSingle: checkMaybeSingle }))
  const checkIs = jest.fn(() => ({ limit: checkLimit }))
  const checkEq3 = jest.fn(() => ({ is: checkIs }))
  const checkEq2 = jest.fn(() => ({ eq: checkEq3 }))
  const checkEq1 = jest.fn(() => ({ eq: checkEq2 }))
  const concernsSelect = jest.fn(() => ({ eq: checkEq1 }))

  // Insert: .insert({...}).select('id').single()
  const insertSingle = jest.fn(() =>
    Promise.resolve(
      insertError ? { data: null, error: insertError } : { data: { id: 'new-concern' }, error: null }
    )
  )
  const insertSelect = jest.fn(() => ({ single: insertSingle }))
  const concernsInsert = jest.fn(() => ({ select: insertSelect }))

  // DSL lookup: .select('id').eq('role', 'admin')
  const usersEq = jest.fn(() => Promise.resolve({ data: dslIds.map(id => ({ id })) }))
  const usersSelect = jest.fn(() => ({ eq: usersEq }))

  const from = jest.fn((table: string) => {
    if (table === 'safeguarding_concerns') return { select: concernsSelect, insert: concernsInsert }
    if (table === 'users') return { select: usersSelect }
    throw new Error(`Unexpected table in test: ${table}`)
  })

  return { from }
}

beforeEach(() => {
  notifyUsersMock.mockClear()
})

describe('autoRaiseConcern', () => {
  it('inserts a concern and notifies the DSL when none exists yet today', async () => {
    const admin = makeAdminMock()
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: true })
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    expect(notifyUsersMock).toHaveBeenCalledWith(
      admin,
      ['dsl-1'],
      expect.objectContaining({ title: BASE_PARAMS.notifyTitle, url: BASE_PARAMS.notifyUrl })
    )
  })

  it('skips and does not notify when a concern already exists today', async () => {
    const admin = makeAdminMock({ alreadyRaisedToday: true })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: false })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('treats a unique-violation (23505) insert error as a race loss, not a failure', async () => {
    const admin = makeAdminMock({ insertError: { code: '23505' } })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: false })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('logs and returns raised:false on an unexpected insert error, without throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const admin = makeAdminMock({ insertError: { code: 'XXXXX' } })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: false })
    expect(notifyUsersMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('does not notify when there are no admin users, but still reports raised:true', async () => {
    const admin = makeAdminMock({ dslIds: [] })
    const result = await autoRaiseConcern(admin as any, BASE_PARAMS)
    expect(result).toEqual({ raised: true })
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest autoRaiseConcern -v`
Expected: FAIL with "Cannot find module '@/lib/safeguarding/autoRaiseConcern'"

- [ ] **Step 3: Write the implementation**

Create `lib/safeguarding/autoRaiseConcern.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { londonDateISO } from '@/lib/dates'
import { notifyUsers } from '@/lib/notifications/notifyStaff'
import type { ConcernCategory, ConcernSeverity } from '@/lib/safeguarding/safeguardingUtils'

export type AutoRaiseConcernParams = {
  studentId: string
  category: ConcernCategory
  severity: ConcernSeverity
  description: string
  notifyTitle: string
  notifyBody: string
  notifyUrl: string
}

/**
 * Auto-raises a system safeguarding concern (raised_by: null) and notifies
 * the DSL (admin role — safeguarding cases are admin-only casework, same
 * convention as app/api/cron/attendance-safeguarding-check/route.ts) on
 * success.
 *
 * Race-guarded by the existing partial unique index
 * safeguarding_concerns_one_auto_per_day (supabase/migrations/060) exactly
 * like attendance-safeguarding-check: a 23505 (unique violation) on insert
 * means another concurrent call already raised it for this
 * student/category/day, which is treated as success, not failure.
 *
 * Best-effort — never throws. A bug here must never break the caller
 * (a chat reply, a survey submission, etc).
 */
export async function autoRaiseConcern(
  admin: SupabaseClient,
  params: AutoRaiseConcernParams,
): Promise<{ raised: boolean }> {
  try {
    const today = londonDateISO()

    const { data: already } = await admin
      .from('safeguarding_concerns')
      .select('id')
      .eq('student_id', params.studentId)
      .eq('category', params.category)
      .eq('raised_date', today)
      .is('raised_by', null)
      .limit(1)
      .maybeSingle()
    if (already) return { raised: false }

    const { data: concern, error: insertError } = await admin
      .from('safeguarding_concerns')
      .insert({
        student_id: params.studentId,
        raised_by: null,
        category: params.category,
        raised_date: today,
        severity: params.severity,
        description: params.description,
        status: 'open',
      })
      .select('id')
      .single()

    if (insertError) {
      if (insertError.code !== '23505') {
        console.error('[autoRaiseConcern] insert failed:', insertError)
      }
      return { raised: false }
    }
    if (!concern) return { raised: false }

    const { data: dsl } = await admin.from('users').select('id').eq('role', 'admin')
    const dslIds = (dsl ?? []).map(d => d.id as string)
    if (dslIds.length > 0) {
      await notifyUsers(admin, dslIds, {
        title: params.notifyTitle,
        body: params.notifyBody,
        url: params.notifyUrl,
      })
    }

    return { raised: true }
  } catch (err) {
    console.error('[autoRaiseConcern] unexpected error:', err)
    return { raised: false }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest autoRaiseConcern -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/safeguarding/autoRaiseConcern.ts __tests__/lib/safeguarding/autoRaiseConcern.test.ts
git commit -m "feat(safeguarding): add race-safe autoRaiseConcern helper

Mirrors the exact race-safe insert pattern already proven in
attendance-safeguarding-check (upfront dedup check + insert, 23505 =
another concurrent call won the race, not a failure) and composes it
with the new notifyUsers helper to alert the DSL (admin role) on
success. Best-effort — never throws.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 4: Wire the wellbeing submit route to the shared notify helper

**Files:**
- Modify: `app/api/wellbeing/submit/route.ts:1-43`
- Test: `__tests__/lib/wellbeing/submitRoute.test.ts`

**Interfaces:**
- Consumes: `notifyUsers` from Task 2.

This route currently loops staff members and calls `sendPushNotificationToUser` per staff member (web push only — missing native/FCM delivery). This task swaps that loop for a single `notifyUsers` call. No other behavior changes.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/wellbeing/submitRoute.test.ts`. This focuses on the changed notify wiring, plus minimal smoke coverage of the surrounding auth/success flow — the other pre-existing branches (invalid answers, insert failure) are untouched by this task and are not re-tested here.

```ts
/**
 * @jest-environment node
 */
const getUserMock = jest.fn()
const supabaseFromMock = jest.fn()
const adminFromMock = jest.fn()
const notifyUsersMock = jest.fn(() => Promise.resolve())

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock }, from: supabaseFromMock }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/notifications/notifyStaff', () => ({
  notifyUsers: (...args: unknown[]) => notifyUsersMock(...args),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/wellbeing/submit/route'

const STUDENT_ID = 'student-1'
const SURVEY_ID = 'survey-1'
const VALID_ANSWERS = { mood: 5, sleep: 5, energy: 5, stress: 1, football_enjoyment: 5 }

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/wellbeing/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Wires the user-scoped supabase client used for survey lookup/insert/update. */
function setupSupabase(opts: { surveyExists?: boolean; insertError?: { message: string } | null } = {}) {
  const { surveyExists = true, insertError = null } = opts

  supabaseFromMock.mockImplementation((table: string) => {
    if (table === 'wellbeing_surveys') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: surveyExists ? { id: SURVEY_ID, status: 'open' } : null }),
              }),
            }),
          }),
        }),
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      }
    }
    if (table === 'wellbeing_responses') {
      return { insert: async () => ({ error: insertError }) }
    }
    throw new Error(`Unexpected table (supabase): ${table}`)
  })
}

/** Wires the admin client used inside notifyStaffOfRedFlag. */
function setupAdmin(opts: { staffIds?: string[] } = {}) {
  const { staffIds = ['staff-1', 'staff-2'] } = opts

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { name: 'Test Student' } }) }),
          in: () => Promise.resolve({ data: staffIds.map(id => ({ id })) }),
        }),
      }
    }
    throw new Error(`Unexpected table (admin): ${table}`)
  })
}

beforeEach(() => {
  getUserMock.mockReset()
  supabaseFromMock.mockReset()
  adminFromMock.mockReset()
  notifyUsersMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: STUDENT_ID } } })
})

describe('POST /api/wellbeing/submit', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the survey is not open / not found', async () => {
    setupSupabase({ surveyExists: false })
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(404)
  })

  it('saves the survey and does NOT notify staff when there are no red flags', async () => {
    setupSupabase()
    setupAdmin()
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: VALID_ANSWERS, notes: {} }))
    expect(res.status).toBe(200)
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('notifies staff via notifyUsers when a response is red-flagged', async () => {
    setupSupabase()
    setupAdmin({ staffIds: ['staff-1', 'staff-2'] })
    const flaggedAnswers = { ...VALID_ANSWERS, mood: 1 } // low mood → red flag
    const res = await POST(makeRequest({ survey_id: SURVEY_ID, answers: flaggedAnswers, notes: {} }))
    expect(res.status).toBe(200)
    expect(notifyUsersMock).toHaveBeenCalledTimes(1)
    const [, staffIds, notification] = notifyUsersMock.mock.calls[0]
    expect([...staffIds].sort()).toEqual(['staff-1', 'staff-2'])
    expect(notification).toEqual(expect.objectContaining({ title: 'Wellbeing alert', url: '/admin/wellbeing' }))
    expect(notification.body).toContain('Test Student')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest submitRoute -v`
Expected: FAIL on the "notifies staff via notifyUsers" test — the route still calls `sendPushNotificationToUser` per staff member, never `notifyUsers`, so `notifyUsersMock` is never called.

- [ ] **Step 3: Modify the route**

In `app/api/wellbeing/submit/route.ts`, replace the imports and `notifyStaffOfRedFlag` body:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUsers } from '@/lib/notifications/notifyStaff'
import { validateSurveyAnswers, getRedFlags, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'

/**
 * Alert staff (admins, coaches, teachers) that a submission contained a
 * safeguarding red flag. Students and parents are never notified.
 * Best effort — errors are swallowed so the submission always succeeds.
 */
async function notifyStaffOfRedFlag(studentId: string): Promise<void> {
  try {
    const adminClient = createAdminClient()

    const { data: student } = await adminClient
      .from('users')
      .select('name')
      .eq('id', studentId)
      .maybeSingle()

    const { data: staff } = await adminClient
      .from('users')
      .select('id')
      .in('role', ['admin', 'coach', 'teacher'])
    if (!staff?.length) return

    const studentName = student?.name ?? 'A student'
    await notifyUsers(
      adminClient,
      staff.map(s => s.id),
      {
        title: 'Wellbeing alert',
        body: `${studentName}'s latest wellbeing survey needs attention.`,
        url: '/admin/wellbeing',
      }
    )
  } catch {
    // Never let notification failures affect the submission
  }
}
```

(The rest of the file — `export const dynamic`, the `POST` handler — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest submitRoute -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npx jest --silent`
Expected: PASS, same or higher total than before this task

- [ ] **Step 6: Commit**

```bash
git add app/api/wellbeing/submit/route.ts __tests__/lib/wellbeing/submitRoute.test.ts
git commit -m "fix(wellbeing): send red-flag staff alerts via both push channels

notifyStaffOfRedFlag looped sendPushNotificationToUser per staff member
— web push (VAPID) only, so a staff member on the native iOS/Android
app never received a wellbeing red-flag alert regardless of device
notification permission. Now uses the shared notifyUsers helper
(dual web push + FCM), same fix already shipped for chat pushes/nudges
in commit 45b7412.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 5: AI chat crisis-handling — the core fix

**Files:**
- Modify: `app/api/ai/chat/route.ts` (whole file, ~90 lines — shown in full below)
- Test: `__tests__/lib/ai/chatRoute.test.ts`

**Interfaces:**
- Consumes: `detectDistressSignals` from Task 1, `autoRaiseConcern` from Task 3.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai/chatRoute.test.ts`:

```ts
/**
 * @jest-environment node
 */
const getUserMock = jest.fn()
const adminFromMock = jest.fn()
const anthropicCreateMock = jest.fn(() =>
  Promise.resolve({ content: [{ type: 'text', text: 'AI reply text' }] })
)
const autoRaiseConcernMock = jest.fn(() => Promise.resolve({ raised: true }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}))
jest.mock('@/lib/ai', () => ({
  getAnthropic: () => ({ messages: { create: (...args: unknown[]) => anthropicCreateMock(...args) } }),
  MODELS: { sonnet: 'claude-sonnet-4-5' },
  extractText: (response: { content: { type: string; text: string }[] }) =>
    response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim(),
}))
jest.mock('@/lib/safeguarding/autoRaiseConcern', () => ({
  autoRaiseConcern: (...args: unknown[]) => autoRaiseConcernMock(...args),
}))

import { POST } from '@/app/api/ai/chat/route'

const STUDENT_ID = 'student-1'
const ROOM_ID = 'room-1'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function setupAdmin(opts: {
  isMember?: boolean
  roomKind?: string | null
  history?: { sender_id: string; body: string }[]
  profileName?: string
} = {}) {
  const {
    isMember = true,
    roomKind = 'bot',
    history = [{ sender_id: STUDENT_ID, body: 'Hello' }],
    profileName = 'Test Student',
  } = opts

  adminFromMock.mockImplementation((table: string) => {
    if (table === 'chat_members') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: isMember ? { user_id: STUDENT_ID } : null }) }),
          }),
        }),
      }
    }
    if (table === 'chat_rooms') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: roomKind ? { kind: roomKind } : null }) }),
        }),
      }
    }
    if (table === 'chat_messages') {
      return {
        select: () => ({
          eq: () => ({ is: () => ({ order: () => ({ limit: async () => ({ data: history }) }) }) }),
        }),
        insert: async () => ({ error: null }),
      }
    }
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { name: profileName, role: 'student' } }) }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

beforeEach(() => {
  getUserMock.mockReset()
  adminFromMock.mockReset()
  anthropicCreateMock.mockClear()
  autoRaiseConcernMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: STUDENT_ID } } })
})

describe('POST /api/ai/chat', () => {
  it('returns 401 when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member (e.g. a stale/invalid roomId), not a 500', async () => {
    setupAdmin({ isMember: false })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when the room is not a bot room', async () => {
    setupAdmin({ roomKind: 'custom' })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(400)
  })

  it('replies normally and does not raise a concern for an ordinary message', async () => {
    setupAdmin({ history: [{ sender_id: STUDENT_ID, body: 'How was training today?' }] })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(200)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1)
    expect(autoRaiseConcernMock).not.toHaveBeenCalled()
  })

  it('still replies AND raises a concern when the message matches distress signals', async () => {
    setupAdmin({ history: [{ sender_id: STUDENT_ID, body: "I've been thinking about ending my life" }] })
    const res = await POST(makeRequest({ roomId: ROOM_ID }))
    expect(res.status).toBe(200)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1)
    expect(autoRaiseConcernMock).toHaveBeenCalledTimes(1)
    const [, params] = autoRaiseConcernMock.mock.calls[0]
    expect(params).toEqual(
      expect.objectContaining({
        studentId: STUDENT_ID,
        category: 'wellbeing',
        severity: 'high',
        notifyUrl: `/chat/${ROOM_ID}`,
      })
    )
  })

  it('includes the distress-handling instructions in the system prompt sent to Claude', async () => {
    setupAdmin()
    await POST(makeRequest({ roomId: ROOM_ID }))
    const call = anthropicCreateMock.mock.calls[0][0] as { system: string }
    expect(call.system).toMatch(/Childline/)
    expect(call.system).toMatch(/Samaritans/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest chatRoute -v`
Expected: FAIL — the 403 test fails because `.single()` throws/errors instead of returning a clean 403 today; the distress and system-prompt tests fail because neither the detector call nor the new prompt text exist yet.

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `app/api/ai/chat/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { detectDistressSignals } from '@/lib/safeguarding/distressDetection'
import { autoRaiseConcern } from '@/lib/safeguarding/autoRaiseConcern'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId } = await request.json()
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify membership
  const { data: member } = await admin
    .from('chat_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify bot room
  const { data: room } = await admin.from('chat_rooms').select('kind').eq('id', roomId).maybeSingle()
  if (!room || room.kind !== 'bot') return NextResponse.json({ error: 'Not a bot room' }, { status: 400 })

  // Get recent message history (last 20)
  const { data: msgs } = await admin
    .from('chat_messages')
    .select('sender_id, body')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const history = (msgs ?? []).reverse()

  // Build Claude message history
  const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of history) {
    if (!m.body) continue
    if (m.sender_id === BOT_USER_ID) {
      claudeMessages.push({ role: 'assistant', content: m.body })
    } else {
      claudeMessages.push({ role: 'user', content: m.body })
    }
  }

  // Ensure last message is from user
  if (!claudeMessages.length || claudeMessages[claudeMessages.length - 1].role !== 'user') {
    return NextResponse.json({ ok: true })
  }

  const latestUserMessage = claudeMessages[claudeMessages.length - 1].content

  // Fetch student profile for context
  const { data: profile } = await admin
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  try {
    const anthropic = getAnthropic()

    // Safeguarding safety net: detection runs independently of the AI's own
    // reply, so a human is notified regardless of what Claude says. Awaited
    // alongside the Claude call (not fire-and-forget) — a serverless
    // function suspends the instant the response is returned, so an
    // un-awaited notification can silently never send. Best-effort —
    // autoRaiseConcern never throws, so it can never fail the chat reply.
    const signals = detectDistressSignals(latestUserMessage)
    const escalationPromise = signals.length > 0
      ? autoRaiseConcern(admin, {
          studentId: user.id,
          category: 'wellbeing',
          severity: 'high',
          description:
            `Auto-detected by the AI Coach chat: a message from ${profile?.name ?? 'this student'} ` +
            `matched distress signals (${signals.join(', ')}). Review the conversation in the ` +
            `student's chat and follow up directly — the AI's reply to the student is not a ` +
            `substitute for a welfare check.`,
          notifyTitle: `⚠️ Possible distress signal: ${profile?.name ?? 'A student'}`,
          notifyBody: 'A message in the AI Coach chat matched distress signals. Please review and follow up.',
          notifyUrl: `/chat/${roomId}`,
        })
      : Promise.resolve({ raised: false })

    const [response] = await Promise.all([
      anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 512,
        system: `You are the AI Coach for Tranmere Rovers Football Academy. You help student athletes with training advice, nutrition, coursework, motivation, and personal development. Be encouraging, direct, and practical. Use British English. Keep replies concise — 2-4 sentences unless the student asks for more detail. The student's name is ${profile?.name ?? 'the student'}.

If a message shows signs of real distress — self-harm, suicidal thoughts, abuse, or feeling hopeless or unsafe — respond with empathy first. Do not try to diagnose or handle it yourself. Gently encourage them to talk to a coach, teacher, or another trusted adult at the academy, and mention Childline (0800 1111) or Samaritans (116 123) as someone they can talk to any time, or 999 if they're in immediate danger. Keep this brief and caring, not a lecture. For every other message, respond normally as above.`,
        messages: claudeMessages,
      }),
      escalationPromise,
    ])

    const reply = extractText(response)

    // Insert bot reply
    await admin.from('chat_messages').insert({
      room_id: roomId,
      sender_id: BOT_USER_ID,
      body: reply,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest chatRoute -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite and type-check**

Run: `npx jest --silent`
Expected: PASS, total test count higher than the pre-plan baseline (869 + these new suites)

Run: `npx tsc --noEmit 2>&1 | grep -v "__tests__"`
Expected: no new errors outside `__tests__/` (the repo's pre-existing `tsc --noEmit` jest-types gap under `__tests__/` is unrelated — see prior session notes)

- [ ] **Step 6: Commit**

```bash
git add app/api/ai/chat/route.ts __tests__/lib/ai/chatRoute.test.ts
git commit -m "fix(ai-chat): add crisis-response guidance + deterministic escalation

The AI Coach chatbot had no distress/crisis-handling instruction at all
— a repo-wide search for self-harm/suicide/crisis language returned
nothing. Fixes:

- detectDistressSignals runs on every incoming student message,
  independently of the AI's own judgment, and auto-raises a
  safeguarding_concerns case + notifies the DSL via autoRaiseConcern
  when it matches — a human is notified even if the AI's reply is
  imperfect. Awaited alongside the Claude call so the notification
  can't be silently dropped by serverless suspension.
- System prompt gains explicit crisis-response guidance: respond with
  empathy, never diagnose, always name a real next step (a trusted
  adult) plus Childline/Samaritans/999. Ordinary conversation is
  unaffected.
- Three .single() calls (membership, room kind, profile) become
  .maybeSingle() — an invalid/stale roomId no longer risks a 500
  instead of the intended 403/400.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Self-Review

**Spec coverage:**
- Goal 1 (crisis-aware AI reply) → Task 5, system prompt change. ✅
- Goal 2 (deterministic human notification independent of the AI) → Tasks 1, 3, 5 (`detectDistressSignals` + `autoRaiseConcern`, awaited alongside the Claude call). ✅
- Goal 3 (`.single()` fix + shared dual-channel helper + wellbeing route fix) → Task 5 (maybeSingle), Task 2 (`notifyUsers`), Task 4 (wellbeing route). ✅
- Privacy note (no raw message text in the concern row) → Task 5's `description` string references the conversation, does not quote it verbatim. ✅
- Non-goals (no LLM classifier, no chat-transcript viewer, no `attendance-safeguarding-check` changes) → not touched by any task. ✅

**Placeholder scan:** No TBD/TODO; every step has complete, runnable code.

**Type consistency:** `AutoRaiseConcernParams` (Task 3) matches the object literal built in Task 5 exactly (`studentId`, `category`, `severity`, `description`, `notifyTitle`, `notifyBody`, `notifyUrl`). `notifyUsers(admin, userIds, notification)` signature (Task 2) matches every call site (Task 3, Task 4). `detectDistressSignals(text): string[]`-compatible return (Task 1) matches its usage as `signals.length > 0` / `signals.join(', ')` (Task 5).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-ai-chat-crisis-handling.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
