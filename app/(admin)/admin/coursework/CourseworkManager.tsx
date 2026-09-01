// app/(admin)/admin/coursework/CourseworkManager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus, Pencil, Trash2, ClipboardCheck } from 'lucide-react'
import type { BtecUnitRow, AssignmentRow } from '@/lib/coursework/courseworkUtils'

type Props = { units: BtecUnitRow[]; assignments: AssignmentRow[] }

const EMPTY_FORM = { title: '', description: '', due_date: '', grade_target: '' }

export function CourseworkManager({ units, assignments }: Props) {
  const router = useRouter()
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function startAdd(unitId: string) {
    setActiveUnitId(unitId)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(unitId: string, assignment: AssignmentRow) {
    setActiveUnitId(unitId)
    setEditingId(assignment.id)
    setForm({
      title: assignment.title,
      description: assignment.description ?? '',
      due_date: assignment.due_date,
      grade_target: assignment.grade_target ?? '',
    })
  }

  function cancel() {
    setActiveUnitId(null)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent, unitId: string) {
    e.preventDefault()
    if (!form.title.trim() || !form.due_date) return
    setLoading(true)
    const body = {
      unit_id: unitId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date,
      grade_target: form.grade_target.trim() || null,
    }
    const res = await fetch(
      editingId ? `/api/admin/assignments/${editingId}` : '/api/admin/assignments',
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      cancel()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to save assignment')
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      if (editingId === id) cancel()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to delete assignment')
    }
  }

  return (
    <div className="space-y-6">
      {units.map(unit => {
        const unitAssignments = assignments.filter(a => a.unit_id === unit.id)
        const isAdding = activeUnitId === unit.id

        return (
          <div key={unit.id} className="space-y-2">
            <p className="text-sm font-semibold text-tranmere-blue">
              {unit.unit_number} · {unit.unit_name}
            </p>

            <div className="space-y-2">
              {unitAssignments.length === 0 && !isAdding && (
                <p className="text-sm text-muted-foreground">No assignments yet.</p>
              )}
              {unitAssignments.map(assignment => (
                <div key={assignment.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-tranmere-blue">
                      Due {new Date(assignment.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-sm font-medium truncate">{assignment.title}</p>
                    {assignment.grade_target && (
                      <p className="text-xs text-muted-foreground mt-0.5">Target: {assignment.grade_target}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Link
                      href={`/admin/coursework?course=${unit.course_id}&grade=${assignment.id}`}
                      aria-label={`Grade ${assignment.title}`}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <ClipboardCheck size={15} />
                    </Link>
                    <button
                      onClick={() => startEdit(unit.id, assignment)}
                      aria-label={`Edit ${assignment.title}`}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(assignment.id, assignment.title)}
                      aria-label={`Delete ${assignment.title}`}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {isAdding ? (
              <form onSubmit={e => submit(e, unit.id)} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
                <p className="text-sm font-semibold text-tranmere-blue">
                  {editingId ? 'Edit assignment' : 'Add assignment'}
                </p>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title, e.g. Coaching Portfolio"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                  required
                />
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                    required
                  />
                  <input
                    value={form.grade_target}
                    onChange={e => setForm(f => ({ ...f, grade_target: e.target.value }))}
                    placeholder="Target grade (optional)"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!form.title.trim() || !form.due_date || loading}
                    className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
                  >
                    <CalendarPlus size={15} />
                    {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add assignment'}
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => startAdd(unit.id)}
                className="text-sm font-medium text-tranmere-blue hover:underline"
              >
                + Add assignment
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
