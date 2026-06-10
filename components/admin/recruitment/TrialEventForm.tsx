'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TrialEventForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (title.trim() === '') {
      setError('Please enter a title.')
      return
    }
    if (eventDate === '') {
      setError('Please choose an event date.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/recruitment/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          event_date: eventDate,
          location: location.trim() === '' ? null : location.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to create trial event.')
        return
      }
      setTitle('')
      setEventDate('')
      setLocation('')
      setNotes('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold text-gray-900">New trial event</h2>

      <div className="space-y-1">
        <label htmlFor="trial-title" className="block text-xs font-semibold text-gray-700">Title</label>
        <input
          id="trial-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. U15 open trial"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="trial-date" className="block text-xs font-semibold text-gray-700">Date</label>
        <input
          id="trial-date"
          type="date"
          value={eventDate}
          onChange={e => setEventDate(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="trial-location" className="block text-xs font-semibold text-gray-700">Location (optional)</label>
        <input
          id="trial-location"
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Solar Campus"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="trial-notes" className="block text-xs font-semibold text-gray-700">Notes (optional)</label>
        <textarea
          id="trial-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}
