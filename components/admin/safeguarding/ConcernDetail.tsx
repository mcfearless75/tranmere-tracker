'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ConcernStatus,
  CONCERN_STATUSES,
  CATEGORY_LABELS,
  STATUS_LABELS,
  SafeguardingConcern,
  SafeguardingNote,
} from '@/lib/safeguarding/safeguardingUtils'
import { SeverityBadge, StatusBadge } from './ConcernBadges'

interface ConcernDetailProps {
  concern: SafeguardingConcern
  notes: SafeguardingNote[]
  studentName: string
  authorNames: Record<string, string>
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ConcernDetail({ concern, notes, studentName, authorNames }: ConcernDetailProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ConcernStatus>(concern.status)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  async function handleStatusChange(next: ConcernStatus) {
    setStatus(next)
    setStatusError(null)
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/safeguarding/${concern.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus(concern.status)
        setStatusError(typeof data.error === 'string' ? data.error : 'Failed to update status.')
        return
      }
      router.refresh()
    } catch {
      setStatus(concern.status)
      setStatusError('Network error — please try again.')
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    setNoteError(null)
    if (noteText.trim() === '') {
      setNoteError('Please enter a note.')
      return
    }
    setSavingNote(true)
    try {
      const res = await fetch(`/api/safeguarding/${concern.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setNoteError(typeof data.error === 'string' ? data.error : 'Failed to add note.')
        return
      }
      setNoteText('')
      router.refresh()
    } catch {
      setNoteError('Network error — please try again.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Concern summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">{studentName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CATEGORY_LABELS[concern.category]}
              {' · '}
              Raised {formatDateTime(concern.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <SeverityBadge severity={concern.severity} />
            <StatusBadge status={status} />
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm text-gray-700">{concern.description}</p>
      </div>

      {/* Status update */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
        <label htmlFor="status" className="block text-sm font-semibold text-gray-900">Update status</label>
        <select
          id="status"
          value={status}
          disabled={savingStatus}
          onChange={e => handleStatusChange(e.target.value as ConcernStatus)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 disabled:opacity-50"
        >
          {CONCERN_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        {statusError && <p className="text-xs text-red-600">{statusError}</p>}
      </div>

      {/* Notes timeline */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-tranmere-blue">Notes timeline</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ol className="space-y-2">
            {notes.map(n => (
              <li key={n.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                <p className="whitespace-pre-wrap text-sm text-gray-800">{n.note}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {n.author_id ? (authorNames[n.author_id] ?? 'Staff') : 'Staff'}
                  {' · '}
                  {formatDateTime(n.created_at)}
                </p>
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={handleAddNote} className="space-y-2">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={3}
            placeholder="Add a note to the case timeline…"
            aria-label="Add a note"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
          {noteError && <p className="text-xs text-red-600">{noteError}</p>}
          <button
            type="submit"
            disabled={savingNote}
            className="rounded-xl bg-tranmere-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingNote ? 'Adding…' : 'Add note'}
          </button>
        </form>
      </div>
    </div>
  )
}
