'use client'

/**
 * Shared POST-and-classify logic for /api/attendance/tap-checkin, used by
 * both InAppCheckIn.tsx (a fresh tap) and PhaseDayCard.tsx (the offline
 * queue's retry sweep — see checkInQueue.ts) so there's exactly one place
 * that decides what counts as success / a definitive rejection / a
 * plausibly-transient failure.
 */

import type { AttendancePhase } from '@/lib/attendance/phase'
import type { SubmitResult } from '@/lib/attendance/checkInQueue'

export type SubmitOutcome =
  | { kind: 'success' }
  | { kind: 'alreadyCheckedIn' }
  | { kind: 'serverError'; status: number }
  | { kind: 'rejected'; status: number; error: string }

/**
 * Posts one check-in attempt and classifies the response. A thrown fetch
 * (network genuinely down — DNS failure, no connection, CORS) propagates to
 * the caller unchanged; everything else resolves to a discriminated result
 * so 4xx (definitive rejection: outside fence/window, unauthorised, invalid
 * phase) and 5xx (plausibly transient) can be told apart — both arrive as a
 * normal resolved response, so `res.status` has to be checked explicitly
 * rather than relying on try/catch alone.
 */
export async function submitTapCheckIn(
  phase: AttendancePhase,
  geo: { lat: number | null; lng: number | null; accuracy: number | null },
  geoPermissionDenied: boolean,
): Promise<SubmitOutcome> {
  const res = await fetch('/api/attendance/tap-checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase,
      geo_lat: geo.lat,
      geo_lng: geo.lng,
      geo_accuracy_m: geo.accuracy,
      geo_permission_denied: geoPermissionDenied,
    }),
  })
  if (res.status >= 500) return { kind: 'serverError', status: res.status }
  const json = await res.json()
  if (json.alreadyCheckedIn) return { kind: 'alreadyCheckedIn' }
  if (!json.ok) return { kind: 'rejected', status: res.status, error: json.error ?? 'Check-in failed' }
  return { kind: 'success' }
}

/** Adapts the richer SubmitOutcome to the queue module's generic SubmitResult shape. */
export function toSubmitResult(outcome: SubmitOutcome): SubmitResult {
  switch (outcome.kind) {
    case 'success': return { ok: true, status: 200 }
    case 'alreadyCheckedIn': return { ok: true, alreadyCheckedIn: true, status: 200 }
    case 'serverError': return { ok: false, status: outcome.status }
    case 'rejected': return { ok: false, status: outcome.status, error: outcome.error }
  }
}
