'use client'

// Tiny per-phase-cell staff control: "Mark" when the phase is missing,
// "Undo" when it was manually marked. Fallback for when a student's phone
// dies — replaces the old "fix it in SQL" workflow.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function OverrideButton({
  studentId,
  date,
  phase,
  present,
}: {
  studentId: string
  date: string
  phase: 'am' | 'lunch' | 'pm'
  present: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const action = present ? 'clear' : 'mark_present'
  const label = present ? 'Undo' : 'Mark'

  const submit = async () => {
    if (present && !window.confirm(`Clear this ${phase.toUpperCase()} check-in?`)) return
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/attendance/manual-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, phase, action }),
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
    <button
      type="button"
      onClick={submit}
      disabled={busy || pending}
      title={present ? 'Clear this check-in (manual override)' : 'Mark present now (manual override — will be flagged)'}
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors disabled:opacity-40 ${
        error
          ? 'border-red-300 text-red-600 bg-red-50'
          : present
            ? 'border-gray-200 text-muted-foreground hover:bg-gray-100'
            : 'border-tranmere-blue/30 text-tranmere-blue hover:bg-tranmere-blue/10'
      }`}
    >
      {busy || pending ? '…' : error ? 'Retry' : label}
    </button>
  )
}
