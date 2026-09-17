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
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 flex-wrap rounded-xl bg-blue-50 border border-tranmere-blue/20 px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-tranmere-blue">
          <input type="checkbox" checked={allOn} onChange={toggleAll} className="h-5 w-5 accent-tranmere-blue" />
          Select all ({students.length})
        </label>
        <button
          type="button"
          onClick={markSelectedPresent}
          disabled={busy || pending || selectedIds.length === 0}
          className="text-sm font-semibold px-3 py-2 rounded-lg bg-tranmere-blue text-white disabled:opacity-40"
        >
          {busy || pending ? 'Marking…' : selectedIds.length ? `Mark ${selectedIds.length} present` : 'Mark present'}
        </button>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
      <ul className="divide-y">
        {students.map(s => (
          <li key={s.studentId} className="flex items-center justify-between gap-2 py-2 text-sm flex-wrap">
            <label className="flex items-center gap-3 min-w-0 font-medium flex-1">
              <input
                type="checkbox"
                checked={!!selected[s.studentId]}
                onChange={() => toggle(s.studentId)}
                className="h-5 w-5 shrink-0 accent-tranmere-blue"
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
