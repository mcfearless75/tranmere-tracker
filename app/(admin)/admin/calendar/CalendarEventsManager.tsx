'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { formatEventTime, type CalendarEventRow } from '@/lib/calendar/calendarUtils'

type Props = { events: CalendarEventRow[] }

const EMPTY_FORM = { title: '', event_date: '', event_time: '', description: '' }

export function CalendarEventsManager({ events }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function startEdit(event: CalendarEventRow) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time?.slice(0, 5) ?? '',
      description: event.description ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) return
    setLoading(true)
    const body = {
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || null,
      description: form.description.trim() || null,
    }
    const res = await fetch(
      editingId ? `/api/admin/calendar-events/${editingId}` : '/api/admin/calendar-events',
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
      alert(data.error ?? 'Failed to save event')
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    const res = await fetch(`/api/admin/calendar-events/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      if (editingId === id) cancelEdit()
      router.refresh()
    } else {
      alert(data.error ?? 'Failed to delete event')
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
        <p className="text-sm font-semibold text-tranmere-blue">
          {editingId ? 'Edit event' : 'Add event'}
        </p>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Title, e.g. Kit collection day"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          required
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={form.event_date}
            onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
            required
          />
          <input
            type="time"
            value={form.event_time}
            onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
        </div>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)"
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-tranmere-blue outline-none"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!form.title.trim() || !form.event_date || loading}
            className="flex items-center gap-1.5 bg-tranmere-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-900 transition-colors"
          >
            <CalendarPlus size={15} />
            {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add event'}
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
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          events.map(event => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-tranmere-blue">
                  {new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {event.event_time && ` · ${formatEventTime(event.event_time)}`}
                </p>
                <p className="text-sm font-medium truncate">{event.title}</p>
                {event.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => startEdit(event)}
                  aria-label={`Edit ${event.title}`}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(event.id, event.title)}
                  aria-label={`Delete ${event.title}`}
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
