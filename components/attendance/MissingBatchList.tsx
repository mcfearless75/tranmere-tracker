'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
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
    if (failed.length) setError(`Could not mark: ${failed.join(', ')}`)
    else setSelected({})
    startTransition(() => router.refresh())
  }

  if (students.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-tranmere-blue text-white p-3 space-y-2">
        <p className="text-sm font-bold">Batch select</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="flex-1 rounded-lg bg-white text-tranmere-blue text-sm font-semibold py-2.5"
          >
            {allOn ? 'Clear all' : `Select all (${students.length})`}
          </button>
          <button
            type="button"
            onClick={markSelectedPresent}
            disabled={busy || pending || selectedIds.length === 0}
            className="flex-1 rounded-lg bg-white/15 border border-white/40 text-sm font-semibold py-2.5 disabled:opacity-40"
          >
            {busy || pending ? 'Marking…' : selectedIds.length ? `Mark ${selectedIds.length} present` : 'Mark present'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
      <ul className="divide-y">
        {students.map(s => {
          const on = !!selected[s.studentId]
          return (
            <li key={s.studentId} className="py-2 space-y-2">
              <button
                type="button"
                onClick={() => toggle(s.studentId)}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 ${
                  on ? 'border-tranmere-blue bg-tranmere-blue text-white' : 'border-gray-300 bg-white'
                }`}>
                  {on && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="font-medium text-sm">{s.name}</span>
              </button>
              <div className="pl-10">
                <MissingRowActions studentId={s.studentId} studentName={s.name} date={date} phase={phase} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
