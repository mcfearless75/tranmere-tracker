'use client'

// Row-level staff control: records a known reason a student isn't expected
// in (ill / appointment / other), whole day by default. See ExcusedPill for
// the per-phase narrowing control shown on individual AM/Lunch/PM cells.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EXCUSAL_LABELS, EXCUSAL_REASONS, type ExcusalReason } from '@/lib/attendance/excusal'

export function ExcuseButton({
  studentId,
  date,
  excusal,
}: {
  studentId: string
  date: string
  excusal: { reason: ExcusalReason; note: string | null } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(false)

  const submit = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/attendance/excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, date, ...body }),
      })
      if (!res.ok) throw new Error()
      setPicking(false)
      startTransition(() => router.refresh())
    } catch {
      setPicking(false)
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const excuse = (reason: ExcusalReason) => {
    const note = window.prompt(`Optional note (e.g. "back for PM"):`)?.trim()
    submit({ action: 'excuse', reason, note: note || undefined })
  }

  const undo = () => {
    if (!window.confirm('Clear this excusal? Any uncovered phases will go back to "missing".')) return
    submit({ action: 'clear' })
  }

  if (excusal) {
    return (
      <button
        type="button"
        onClick={undo}
        disabled={busy || pending}
        title={excusal.note ?? EXCUSAL_LABELS[excusal.reason]}
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200 text-muted-foreground hover:bg-gray-100 disabled:opacity-40 shrink-0"
      >
        {busy || pending ? '…' : `${EXCUSAL_LABELS[excusal.reason]} · Undo`}
      </button>
    )
  }

  if (picking) {
    return (
      <span className="flex items-center gap-1 shrink-0">
        {EXCUSAL_REASONS.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => excuse(r)}
            disabled={busy}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-tranmere-blue/30 text-tranmere-blue hover:bg-tranmere-blue/10 disabled:opacity-40"
          >
            {EXCUSAL_LABELS[r]}
          </button>
        ))}
        <button type="button" onClick={() => setPicking(false)} className="text-[10px] text-muted-foreground px-1">✕</button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPicking(true)}
      title="Record a known reason (ill / appointment) — suppresses missing-checkin alerts for the day"
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 transition-colors ${
        error ? 'border-red-300 text-red-600 bg-red-50' : 'border-gray-200 text-muted-foreground hover:bg-gray-100'
      }`}
    >
      {error ? 'Retry' : 'Excuse'}
    </button>
  )
}
