/**
 * Client-side offline queue for the in-app tap check-in (InAppCheckIn.tsx).
 *
 * Purpose: a student's check-in tap should survive a dropped connection
 * instead of just showing an error. When the POST to
 * /api/attendance/tap-checkin never gets a response (thrown fetch — network
 * genuinely down) or comes back 5xx (server-side/transient, distinct from a
 * definitive rejection), the attempt is saved here and retried automatically
 * once the device is back online. A 4xx (outside fence, window closed,
 * unauthorised, invalid phase) is a final answer from the server and is
 * never queued — see InAppCheckIn.tsx for that split.
 *
 * This module does NOT change server-side check-in idempotency — a flush
 * that lands on an already-completed phase just comes back
 * `{ok:true, alreadyCheckedIn:true}` per the existing route, which this
 * module treats as success.
 *
 * Storage: `localStorage` (survives tab/app close, unlike the sessionStorage
 * used elsewhere in this file's neighbourhood for the one-time geo
 * explainer flag) under a single array key, filtered by phase + London date
 * rather than split across many keys — simpler to cap and dedupe.
 *
 * The actual retry SWEEP (`flushAllQueued`) is deliberately generic over
 * every queued phase, not just "today's" — see its doc comment. It is
 * driven from PhaseDayCard.tsx (mount + browser 'online' event), which is
 * the one place that can see every phase's queue state at once and route
 * each result to the right phase's `checkedAt`. InAppCheckIn.tsx only ever
 * calls `enqueueCheckIn` for its own fresh tap attempt; it does not run its
 * own retry loop — a per-component retry scoped to whichever phase happens
 * to be mounted would silently orphan a queued item for any OTHER phase
 * once the day moves on to the next window.
 */

import type { AttendancePhase } from '@/lib/attendance/phase'
import { londonDateISO } from '@/lib/dates'

export type QueuedCheckIn = {
  phase: AttendancePhase
  lat: number | null
  lng: number | null
  accuracy: number | null
  /** ISO instant the original (failed) attempt was made. */
  recordedAt: string
  /**
   * Europe/London calendar date (YYYY-MM-DD) the attempt belongs to,
   * captured at enqueue time. The server always stamps a check-in against
   * ITS OWN "today" (`londonDateISO()` at request time) — there is no way
   * to backdate a submission — so a queued item is only ever safe to send
   * while this still matches today's date. Once the London day rolls over,
   * sending it would silently record it against the wrong day, so
   * `flushAllQueued` prunes it instead (its 'stale' outcome) without ever
   * calling `submit`.
   */
  londonDate: string
}

export type SubmitResult = {
  ok: boolean
  alreadyCheckedIn?: boolean
  status: number
  error?: string
}

/** One queued item's outcome from a sweep — see `flushAllQueued`. */
export type SweepResult =
  | { phase: AttendancePhase; outcome: 'sent' }
  | { phase: AttendancePhase; outcome: 'dropped'; error: string }
  | { phase: AttendancePhase; outcome: 'kept' }
  | { phase: AttendancePhase; outcome: 'stale' }

const QUEUE_KEY = 'checkin_queue_v1'
const MAX_QUEUE_SIZE = 5

function readQueue(): QueuedCheckIn[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueuedCheckIn[]) : []
  } catch {
    // Blocked/unavailable storage (private mode, SSR, quota) — behave as if
    // there's simply nothing queued.
    return []
  }
}

function writeQueue(queue: QueuedCheckIn[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Best-effort only — a blocked/full localStorage just means the retry
    // never persists; the in-memory UI state still reflects the attempt.
  }
}

/**
 * Queues a failed check-in attempt for retry. Same phase + same London day
 * replaces the existing queued item (a fresher attempt's coordinates are
 * more useful than a stale one's) rather than appending a duplicate. Caps
 * at MAX_QUEUE_SIZE, dropping the oldest entry first if that's exceeded —
 * expected only in a multi-day-offline edge case, since there are at most
 * 3 phases per day.
 */
export function enqueueCheckIn(item: Omit<QueuedCheckIn, 'londonDate'>): void {
  const londonDate = londonDateISO()
  const queue = readQueue().filter(q => !(q.phase === item.phase && q.londonDate === londonDate))
  queue.push({ ...item, londonDate })
  while (queue.length > MAX_QUEUE_SIZE) queue.shift()
  writeQueue(queue)
}

/** Phases (today only) that currently have a queued, not-yet-sent check-in. */
export function getQueuedPhasesForToday(): AttendancePhase[] {
  const today = londonDateISO()
  return readQueue()
    .filter(q => q.londonDate === today)
    .map(q => q.phase)
}

/**
 * Sweeps EVERY queued item — any phase, any London date — oldest first,
 * via the caller-supplied `submit`. Deliberately does not pre-filter to
 * "today's phase only": a queued item can legitimately sit across a phase
 * boundary (network drops near the end of the AM window, doesn't recover
 * until the lunch window has opened and the AM `InAppCheckIn` has already
 * unmounted) — nothing else in the app will ever revisit that item once
 * `decidePhase` has moved on, so this sweep has to be the one place that
 * still looks for it.
 *
 * Per item:
 *  - a previous-London-day item is 'stale' — pruned WITHOUT ever calling
 *    `submit` (sending it would record against the wrong day server-side,
 *    since the route always stamps its own "today").
 *  - 'sent'    — success or `alreadyCheckedIn:true`; dropped from the queue.
 *  - 'dropped' — a definitive 4xx rejection; dropped from the queue, the
 *                server's message is returned for display.
 *  - 'kept'    — a 5xx response, or `submit` itself threw (still offline);
 *                left queued for the next sweep trigger.
 */
export async function flushAllQueued(
  submit: (item: QueuedCheckIn) => Promise<SubmitResult>,
): Promise<SweepResult[]> {
  const queue = readQueue()
  if (queue.length === 0) return []

  const today = londonDateISO()
  const results: SweepResult[] = []
  const remaining: QueuedCheckIn[] = []

  for (const item of queue) {
    if (item.londonDate !== today) {
      results.push({ phase: item.phase, outcome: 'stale' })
      continue
    }
    try {
      const result = await submit(item)
      if (result.ok || result.alreadyCheckedIn) {
        results.push({ phase: item.phase, outcome: 'sent' })
        continue
      }
      if (result.status >= 500) {
        results.push({ phase: item.phase, outcome: 'kept' })
        remaining.push(item)
        continue
      }
      results.push({ phase: item.phase, outcome: 'dropped', error: result.error ?? 'Check-in failed' })
    } catch {
      results.push({ phase: item.phase, outcome: 'kept' })
      remaining.push(item)
    }
  }

  writeQueue(remaining)
  return results
}
