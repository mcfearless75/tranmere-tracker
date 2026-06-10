'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ProspectStatus,
  PROSPECT_STATUSES,
  STATUS_META,
  prospectAge,
} from '@/lib/recruitment/recruitmentUtils'
import { ProspectRow, ProspectNoteRow, ProspectTrialHistory } from './types'
import { ProspectStatusBadge } from './ProspectStatusBadge'
import { ProspectNoteForm } from './ProspectNoteForm'
import { formatDate, formatDateTime } from './formatters'

interface ProspectDetailProps {
  prospect: ProspectRow
  notes: ProspectNoteRow[]
  trialHistory: ProspectTrialHistory[]
  authorNames: Record<string, string>
}

export function ProspectDetail({ prospect, notes, trialHistory, authorNames }: ProspectDetailProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ProspectStatus>(prospect.status)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const age = prospectAge(prospect.date_of_birth)

  async function handleStatusChange(next: ProspectStatus) {
    setStatus(next)
    setStatusError(null)
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/recruitment/prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus(prospect.status)
        setStatusError(typeof data.error === 'string' ? data.error : 'Failed to update status.')
        return
      }
      router.refresh()
    } catch {
      setStatus(prospect.status)
      setStatusError('Network error — please try again.')
    } finally {
      setSavingStatus(false)
    }
  }

  const applicationFields: { label: string; value: string }[] = [
    { label: 'Date of birth', value: `${formatDate(prospect.date_of_birth)}${age !== null ? ` (age ${age})` : ''}` },
    { label: 'Position', value: prospect.position ?? 'Not given' },
    { label: 'Preferred foot', value: prospect.preferred_foot ?? 'Not given' },
    { label: 'Current club', value: prospect.current_club ?? 'Not given' },
    { label: 'Contact email', value: prospect.contact_email },
    { label: 'Contact phone', value: prospect.contact_phone ?? 'Not given' },
    { label: 'Parent / guardian', value: prospect.parent_guardian_name },
    { label: 'Consent given', value: prospect.consent_given ? 'Yes' : 'No' },
    { label: 'Source', value: prospect.source === 'public_form' ? 'Public form' : 'Staff entry' },
  ]

  return (
    <div className="space-y-5">
      {/* Application summary */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">
              {prospect.first_name} {prospect.last_name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Applied {formatDateTime(prospect.created_at)}
            </p>
          </div>
          <div className="shrink-0">
            <ProspectStatusBadge status={status} />
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {applicationFields.map(f => (
            <div key={f.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="text-sm text-gray-900">{f.value}</dd>
            </div>
          ))}
        </dl>

        {prospect.notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application notes</p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{prospect.notes}</p>
          </div>
        )}
      </div>

      {/* Status update */}
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
        <label htmlFor="prospect-status" className="block text-sm font-semibold text-gray-900">
          Update status
        </label>
        <select
          id="prospect-status"
          value={status}
          disabled={savingStatus}
          onChange={e => handleStatusChange(e.target.value as ProspectStatus)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 disabled:opacity-50"
        >
          {PROSPECT_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        {statusError && <p className="text-xs text-red-600">{statusError}</p>}
      </div>

      {/* Trial attendance history */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-tranmere-blue">Trial attendance</h2>
        {trialHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trial attendance yet.</p>
        ) : (
          <ul className="space-y-2">
            {trialHistory.map(t => (
              <li key={t.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{t.eventTitle}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.eventDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-semibold ${t.attended ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {t.attended ? 'Attended' : 'Not attended'}
                    </p>
                    {t.rating !== null && (
                      <p className="text-xs text-muted-foreground">Rating {t.rating}/10</p>
                    )}
                  </div>
                </div>
                {t.scout_notes && (
                  <p className="mt-1.5 whitespace-pre-wrap text-xs text-gray-700">{t.scout_notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Scouting notes timeline */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-tranmere-blue">Scouting notes</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ol className="space-y-2">
            {notes.map(n => (
              <li key={n.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                <p className="whitespace-pre-wrap text-sm text-gray-800">{n.note}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {authorNames[n.author_id] ?? 'Staff'}
                  {' · '}
                  {formatDateTime(n.created_at)}
                </p>
              </li>
            ))}
          </ol>
        )}

        <ProspectNoteForm prospectId={prospect.id} />
      </div>
    </div>
  )
}
