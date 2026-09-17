'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Phase } from '@/lib/attendance/dayStatus'
import { postManualOverride } from '@/lib/attendance/attendanceClient'
import { MissingRowActions } from '@/components/attendance/MissingRowActions'

const PHASE_LABEL: Record<Phase, string> = { am: 'AM', lunch: 'lunch', pm: 'PM' }

export function MissingBatchList({
  date,
  phase,
  students,
}: {
  date: string
  phase: Phase
  students: { studentId: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedIds = useMemo(
    () => students.filter(s => selected[s.studentId]).map(s => s.studentId),
    [students, selected],
  )
  const allOn = students.length > 0 && selectedIds.length === students.length
  const label = PHASE_LABEL[phase]

  function toggle(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleAll() {
    if (allOn) {
      setSelected({})
      return
    }
    const next: Record<string, boolean> = {}
    for (const s of students) next[s.studentId] = true
    setSelected(next)
  }

  async function markSelectedPresent() {
    if (selectedIds.length === 0) return
    const names = students.filter(s => selected[s.studentId]).map(s => s.name)
    if (!window.confirm(
      `Mark ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'} present for ${label}?\n\n${names.slice(0, 12).join(', ')}${names.length > 12 ? `…` : ''}\n\nThis is a staff override for kids who are in but did not zap.`,
    )) return

    setBusy(true)
    setError(null)
    const failed: string[] = []
    for (const s of students.filter(st => selected[st.studentId])) {
      try {
        await postManualOverride({ studentId: s.studentId, date, phase, action: 'mark_present' })
      } catch {
        failed.push(s.name)
      }
    }
    setBusy(false)
    if (failed.length) {
      setError(`Could not mark: ${failed.join(', ')}`)
    } else {
      setSelected({})
    }
    startTransition(() => router.refresh())
  }

  if (students.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" checked={allOn} onChange={toggleAll} className="h-4 w-4 accent-tranmere-blue" />
          Select all ({students.length})
        </label>
        <button
          type="button"
          onClick={markSelectedPresent}
          disabled={busy || pending || selectedIds.length === 0}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-tranmere-blue text-white disabled:opacity-40"
        >
          {busy || pending ? 'Marking…' : `Mark ${selectedIds.length || ''} present`.trim()}
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
      <ul className="divide-y">
        {students.map(s => (
          <li key={s.studentId} className="flex items-center justify-between gap-2 py-1.5 text-sm flex-wrap">
            <label className="flex items-center gap-2 min-w-0 font-medium">
              <input
                type="checkbox"
                checked={!!selected[s.studentId]}
                onChange={() => toggle(s.studentId)}
                className="h-4 w-4 shrink-0 accent-tranmere-blue"
              />
              <span className="truncate">{s.name}</span>
            </label>
            <MissingRowActions studentId={s.studentId} studentName={s.name} date={date} phase={phase} />
          </li>
        ))}
      </ul>
    </div>
  )
}
