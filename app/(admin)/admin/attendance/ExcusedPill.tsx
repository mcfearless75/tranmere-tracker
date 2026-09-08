'use client'

// Per-phase-cell control: shown instead of the blank "—"/Mark control when
// this phase is covered by an active excusal. "undo" narrows coverage
// (removes just this phase) rather than clearing the whole excusal — see
// ExcuseButton for the row-level full-clear control.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EXCUSAL_LABELS, type ExcusalReason } from '@/lib/attendance/excusal'
import type { AttendancePhase } from '@/lib/attendance/phase'

export function ExcusedPill({
  studentId, date, phase, reason, note,
}: {
  studentId: string
  date: string
  phase: AttendancePhase
  reason: ExcusalReason
  note: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const clearPhase = async () => {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/attendance/excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, action: 'clear_phase', phase }),
      })
      if (!res.ok) throw new Error()
      startTransition(() => router.refresh())
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span
      title={note ?? EXCUSAL_LABELS[reason]}
      className="flex items-center justify-center gap-1 text-xs font-medium text-gray-500"
    >
      {EXCUSAL_LABELS[reason]}
      <button
        type="button"
        onClick={clearPhase}
        disabled={busy || pending}
        className={`text-[10px] font-semibold px-1 py-0.5 rounded border transition-colors disabled:opacity-40 ${
          error ? 'border-red-300 text-red-600 bg-red-50' : 'underline decoration-dotted'
        }`}
      >
        {busy || pending ? '…' : error ? 'Retry' : 'undo'}
      </button>
    </span>
  )
}
