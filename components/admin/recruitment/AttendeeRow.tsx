'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrialAttendeeRow } from './types'

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface AttendeeRowProps {
  attendee: TrialAttendeeRow
  prospectName: string
}

export function AttendeeRow({ attendee, prospectName }: AttendeeRowProps) {
  const router = useRouter()
  const [attended, setAttended] = useState(attendee.attended)
  const [rating, setRating] = useState<number | null>(attendee.rating)
  const [scoutNotes, setScoutNotes] = useState(attendee.scout_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(
        `/api/recruitment/trials/${attendee.trial_event_id}/attendees/${attendee.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attended,
            rating,
            scout_notes: scoutNotes.trim() === '' ? null : scoutNotes.trim(),
          }),
        },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to save attendee.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{prospectName}</p>
        <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={attended}
            onChange={e => setAttended(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Attended
        </label>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={`rating-${attendee.id}`} className="text-xs font-semibold text-gray-700">
          Rating
        </label>
        <select
          id={`rating-${attendee.id}`}
          value={rating ?? ''}
          onChange={e => setRating(e.target.value === '' ? null : Number(e.target.value))}
          className="rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
        >
          <option value="">—</option>
          {RATING_OPTIONS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">/ 10</span>
      </div>

      <textarea
        value={scoutNotes}
        onChange={e => setScoutNotes(e.target.value)}
        rows={2}
        placeholder="Scout notes…"
        aria-label={`Scout notes for ${prospectName}`}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl bg-tranmere-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </li>
  )
}
