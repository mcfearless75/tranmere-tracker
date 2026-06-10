'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ProspectStatus,
  PROSPECT_STATUSES,
  STATUS_META,
  prospectAge,
} from '@/lib/recruitment/recruitmentUtils'
import { ProspectRow } from './types'
import { ProspectStatusBadge } from './ProspectStatusBadge'
import { formatDate } from './formatters'

interface ProspectListProps {
  prospects: ProspectRow[]
}

type Filter = 'all' | ProspectStatus

export function ProspectList({ prospects }: ProspectListProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? prospects : prospects.filter(p => p.status === filter)

  const counts: Record<string, number> = {}
  for (const p of prospects) {
    counts[p.status] = (counts[p.status] ?? 0) + 1
  }

  return (
    <div className="space-y-3">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
            filter === 'all'
              ? 'border-tranmere-blue bg-tranmere-blue text-white'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          All ({prospects.length})
        </button>
        {PROSPECT_STATUSES.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === s
                ? 'border-tranmere-blue bg-tranmere-blue text-white'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {STATUS_META[s].label} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prospects in this stage.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(p => {
            const age = prospectAge(p.date_of_birth)
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/recruitment/${p.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-3 active:opacity-90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {p.first_name} {p.last_name}
                        {age !== null && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            age {age}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.position ?? 'Position unknown'}
                        {' · '}
                        {p.current_club ?? 'No current club'}
                        {' · '}
                        Applied {formatDate(p.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ProspectStatusBadge status={p.status} />
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
