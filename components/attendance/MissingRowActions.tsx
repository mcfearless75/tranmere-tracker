'use client'

// Compact, one-tap pair of actions for a "missing this phase" row — used on
// both /admin/home's "Missing this window" block and /admin/attendance's
// missing-filter rows, so staff can close the gap without opening the
// student's day page. Reuses the same mutation endpoints as ExcuseButton /
// OverrideButton (via lib/attendance/attendanceClient) rather than a third
// hand-rolled fetch call. Only ever rendered for a phase that is currently
// `missing` — callers must not render this once the phase is checked, late,
// or excused.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Phase } from '@/lib/attendance/dayStatus'
import { postExcuse, postManualOverride } from '@/lib/attendance/attendanceClient'

const PHASE_LABEL: Record<Phase, string> = { am: 'AM', lunch: 'lunch', pm: 'PM' }

export function MissingRowActions({
  studentId,
  studentName,
  date,
  phase,
}: {
  studentId: string
  studentName: string
  date: string
  phase: Phase
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [excuseBusy, setExcuseBusy] = useState(false)
  const [excuseError, setExcuseError] = useState<string | null>(null)
  const [overrideBusy, setOverrideBusy] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)

  const label = PHASE_LABEL[phase]

  const excuse = async () => {
    if (!window.confirm(`Excuse ${studentName}'s ${label} today?`)) return
    setExcuseBusy(true)
    setExcuseError(null)
    try {
      // A quick blanket excusal for just this phase — no reason picker here,
      // that's what ExcuseButton on the full attendance row is for.
      await postExcuse({ studentId, date, action: 'excuse', reason: 'other', phases: [phase] })
      startTransition(() => router.refresh())
    } catch (e) {
      setExcuseError(e instanceof Error && e.message ? e.message : 'Failed — try again')
    } finally {
      setExcuseBusy(false)
    }
  }

  const markPresent = async () => {
    if (!window.confirm(`Mark ${studentName} present for ${label}? This is a staff override.`)) return
    setOverrideBusy(true)
    setOverrideError(null)
    try {
      await postManualOverride({ studentId, date, phase, action: 'mark_present' })
      startTransition(() => router.refresh())
    } catch (e) {
      setOverrideError(e instanceof Error && e.message ? e.message : 'Failed — try again')
    } finally {
      setOverrideBusy(false)
    }
  }

  // Mutual exclusion: while EITHER mutation is in flight (or the post-success
  // router.refresh() transition is pending), both buttons are disabled — not
  // just the one that was clicked. Without this, a double-tap or a slow
  // network lets postExcuse and postManualOverride race against the same
  // studentId/phase/date row (the same bug class as the duplicate-checkin
  // and safeguarding-duplicate-case races this codebase has hit before).
  const anyMutationInFlight = excuseBusy || overrideBusy || pending
  const errorMessage = excuseError ?? overrideError

  return (
    <span className="flex items-center gap-1 flex-wrap shrink-0">
      <button
        type="button"
        onClick={excuse}
        disabled={anyMutationInFlight}
        title={excuseError ?? `Excuse ${label} for ${studentName}`}
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 transition-colors disabled:opacity-40 ${
          excuseError ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-200 text-muted-foreground hover:bg-gray-100'
        }`}
      >
        {excuseBusy || pending ? '…' : excuseError ? 'Retry' : `Excuse ${label}`}
      </button>
      <button
        type="button"
        onClick={markPresent}
        disabled={anyMutationInFlight}
        title={overrideError ?? `Mark ${studentName} present for ${label} (staff override)`}
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 transition-colors disabled:opacity-40 ${
          overrideError ? 'border-red-300 text-red-600 bg-red-50' : 'border-tranmere-blue/30 text-tranmere-blue hover:bg-tranmere-blue/10'
        }`}
      >
        {overrideBusy || pending ? '…' : overrideError ? 'Retry' : 'Mark present'}
      </button>
      {errorMessage && (
        <span role="alert" className="text-[10px] text-red-600 basis-full w-full">
          {errorMessage}
        </span>
      )}
    </span>
  )
}
