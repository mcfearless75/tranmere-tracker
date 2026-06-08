'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import {
  ConcernSeverity,
  ConcernStatus,
  CATEGORY_LABELS,
  STATUS_LABELS,
  SEVERITY_LABELS,
  SafeguardingConcern,
  filterConcerns,
  sortConcerns,
} from '@/lib/safeguarding/safeguardingUtils'
import { SeverityBadge, StatusBadge } from './ConcernBadges'

export interface SuggestedConcern {
  studentId: string
  studentName: string
  reason: string
}

interface ConcernListProps {
  concerns: SafeguardingConcern[]
  studentNames: Record<string, string>
  suggestions: SuggestedConcern[]
}

const STATUS_OPTIONS: Array<ConcernStatus | 'all'> = ['all', 'open', 'monitoring', 'escalated', 'closed']
const SEVERITY_OPTIONS: Array<ConcernSeverity | 'all'> = ['all', 'high', 'medium', 'low']

export function ConcernList({ concerns, studentNames, suggestions }: ConcernListProps) {
  const [status, setStatus] = useState<ConcernStatus | 'all'>('all')
  const [severity, setSeverity] = useState<ConcernSeverity | 'all'>('all')

  const visible = useMemo(
    () => sortConcerns(filterConcerns(concerns, { status, severity })),
    [concerns, status, severity],
  )

  // Surface only red-flag students that do not already have an active concern.
  const openStudentIds = useMemo(
    () => new Set(concerns.filter(c => c.status !== 'closed').map(c => c.student_id)),
    [concerns],
  )
  const newSuggestions = suggestions.filter(s => !openStudentIds.has(s.studentId))

  return (
    <div className="space-y-4">
      {/* Suggested concerns from low wellbeing scores */}
      {newSuggestions.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <h2 className="text-sm font-bold text-red-700">Suggested concerns from wellbeing flags</h2>
          </div>
          <div className="space-y-2">
            {newSuggestions.map(s => (
              <div key={s.studentId} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 border border-red-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.studentName}</p>
                  <p className="text-xs text-red-600">{s.reason}</p>
                </div>
                <Link
                  href={`/admin/safeguarding/new?student=${encodeURIComponent(s.studentId)}`}
                  className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-red-700"
                >
                  Raise concern
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Status
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ConcernStatus | 'all')}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt === 'all' ? 'All' : STATUS_LABELS[opt]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Severity
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as ConcernSeverity | 'all')}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
            aria-label="Filter by severity"
          >
            {SEVERITY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt === 'all' ? 'All' : SEVERITY_LABELS[opt]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No concerns match the current filters.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(c => (
            <Link
              key={c.id}
              href={`/admin/safeguarding/${c.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-tranmere-blue/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {studentNames[c.student_id] ?? 'Unknown student'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CATEGORY_LABELS[c.category]}
                    {' · '}
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <SeverityBadge severity={c.severity} />
                  <StatusBadge status={c.status} />
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-700">{c.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
