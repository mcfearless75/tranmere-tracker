/**
 * Shared client-side fetch wrappers for the two staff attendance mutation
 * endpoints (POST /api/attendance/excuse, POST /api/attendance/manual-override).
 *
 * `ExcuseButton`, `OverrideButton`, `ExcusedPill`, and the compact
 * `MissingRowActions` row all need to call these same endpoints. Rather than
 * each `'use client'` component hand-rolling its own `fetch(...)`, the call
 * itself lives here once — components only decide *when* to call it and how
 * to render busy/error state.
 */

import type { AttendancePhase } from '@/lib/attendance/phase'
import type { ExcusalReason } from '@/lib/attendance/excusal'
import type { OverrideAction } from '@/lib/attendance/manualOverride'

export type ExcuseRequestBody =
  | { studentId: string; date: string; action: 'excuse'; reason: ExcusalReason; note?: string; phases?: AttendancePhase[] }
  | { studentId: string; date: string; action: 'clear' }
  | { studentId: string; date: string; action: 'clear_phase'; phase: AttendancePhase }

export type OverrideRequestBody = {
  studentId: string
  date: string
  phase: AttendancePhase
  action: OverrideAction
}

async function readErrorMessage(res: Response): Promise<string | undefined> {
  const body = await res.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : undefined
}

/** POSTs to /api/attendance/excuse. Throws (with a server-provided message when available) on failure. */
export async function postExcuse(body: ExcuseRequestBody): Promise<void> {
  const res = await fetch('/api/attendance/excuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const message = await readErrorMessage(res)
    throw new Error(message)
  }
}

/** POSTs to /api/attendance/manual-override. Throws (with a server-provided message when available) on failure. */
export async function postManualOverride(body: OverrideRequestBody): Promise<void> {
  const res = await fetch('/api/attendance/manual-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const message = await readErrorMessage(res)
    throw new Error(message)
  }
}
