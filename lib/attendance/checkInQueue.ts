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
   * to backdate a submission — so a queued item is only ever safe to flush
   * while this still matches today's date. Once the London day rolls over,
   * flushing would silently record it against the wrong day, so it must be
   * dropped instead (see `flushQueuedCheckIn`'s 'stale' outcome).
   */
  londonDate: string
}

export type SubmitResult = {
  ok: boolean
  alreadyCheckedIn?: boolean
  status: number
  error?: string
}

export type FlushOutcome =
  | { outcome: 'none' }
  | { outcome: 'sent' }
  | { outcome: 'dropped'; error: string }
  | { outcome: 'kept' }
  | { outcome: 'stale' }

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

/** Is there a queued, not-yet-sent check-in for this phase today? */
export function hasQueuedCheckInToday(phase: AttendancePhase): boolean {
  return getQueuedPhasesForToday().includes(phase)
}

/**
 * Attempts to send the queued item for `phase` (today only), via the
 * caller-supplied `submit`. Outcomes:
 *  - 'none'    — nothing queued for this phase today; no-op.
 *  - 'stale'   — a queued item exists but is from a previous London day;
 *                dropped without ever calling `submit` (see `londonDate`
 *                doc above for why it can't be sent).
 *  - 'sent'    — success or `alreadyCheckedIn:true`; dropped from the queue.
 *  - 'dropped' — a definitive 4xx rejection; dropped from the queue, the
 *                server's message is returned for display.
 *  - 'kept'    — a 5xx response, or `submit` itself threw (still offline);
 *                left queued for the next flush trigger.
 */
export async function flushQueuedCheckIn(
  phase: AttendancePhase,
  submit: (item: QueuedCheckIn) => Promise<SubmitResult>,
): Promise<FlushOutcome> {
  const queue = readQueue()
  const item = queue.find(q => q.phase === phase)
  if (!item) return { outcome: 'none' }

  const today = londonDateISO()
  if (item.londonDate !== today) {
    writeQueue(queue.filter(q => q !== item))
    return { outcome: 'stale' }
  }

  try {
    const result = await submit(item)
    if (result.ok || result.alreadyCheckedIn) {
      writeQueue(readQueue().filter(q => !(q.phase === phase && q.londonDate === today)))
      return { outcome: 'sent' }
    }
    if (result.status >= 500) {
      return { outcome: 'kept' }
    }
    writeQueue(readQueue().filter(q => !(q.phase === phase && q.londonDate === today)))
    return { outcome: 'dropped', error: result.error ?? 'Check-in failed' }
  } catch {
    return { outcome: 'kept' }
  }
}
