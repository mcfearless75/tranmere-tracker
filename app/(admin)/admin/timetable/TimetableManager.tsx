'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

type Props = { slots: TimetableSlotRow[] }

const DAY_OPTIONS = [1, 2, 4, 5] as const

const EMPTY_FORM = {
  title: '',
  day_of_week: 1 as number,
  start_time: '',
  end_time: '',
  location: '',
  tutor: '',
}

export function TimetableManager({ slots }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function startEdit(slot: TimetableSlotRow) {
    setEditingId(slot.id)
    setForm({
      title: slot.title,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
      location: slot.location ?? '',
      tutor: slot.tutor ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.start_time || !form.end_time) return
    setLoading(true)
    const body = {
      title: form.title.trim(),
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location.trim() || null,
      tutor: form.tutor.trim() || null,
    }
    const res = await fetch(
      editingId ? `/api/admin/timetable-slots/${editingId}` : '/api/admin/timetable-slots',
      {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      cancelEdit()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to save session')
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/admin/timetable-slots/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      if (editingId === id) cancelEdit()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to delete session')
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
        <p className="text-sm font-semibold text-tranmere-blue">
          {editingId ? 'Edit session' : 'Add session'}
        </p>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Title, e.g. Coaching & Leadership Prep"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          required
        />
        <div className="flex gap-2">
          <select
            value={form.day_of_week}
            onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          >
            {DAY_OPTIONS.map(day => (
              <option key={day} value={day}>{DAY_LABELS[day]}</option>
            ))}
          </select>
          <input
            type="time"
            value={form.start_time}
            onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
            required
          />
          <input
            type="time"
            value={form.end_time}
            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
            required
          />
        </div>
        <div className="flex gap-2">
          <input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="Location (optional)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
          <input
            value={form.tutor}
            onChange={e => setForm(f => ({ ...f, tutor: e.target.value }))}
            placeholder="Tutor (optional)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!form.title.trim() || !form.start_time || !form.end_time || loading}
            className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
          >
            <CalendarPlus size={15} />
            {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add session'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timetable sessions yet.</p>
        ) : (
          slots.map(slot => (
            <div key={slot.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-tranmere-blue">
                  {DAY_LABELS[slot.day_of_week]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                </p>
                <p className="text-sm font-medium truncate">{slot.title}</p>
                {(slot.location || slot.tutor) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[slot.location, slot.tutor].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(slot)}
                  aria-label={`Edit ${slot.title}`}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(slot.id, slot.title)}
                  aria-label={`Delete ${slot.title}`}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
