import Link from 'next/link'
import {
  Bursary,
  PERIOD_LABELS,
  formatAmount,
  formatDueDate,
} from '@/lib/bursaries/bursaryUtils'
import { BursaryStatusBadge } from './BursaryBadges'

interface BursaryListProps {
  bursaries: Bursary[]
  studentNames: Record<string, string>
  nextDueDates: Record<string, string | null>
}

export function BursaryList({ bursaries, studentNames, nextDueDates }: BursaryListProps) {
  if (bursaries.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-muted-foreground">No bursaries yet. Create one below.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {bursaries.map(b => {
        const nextDue = nextDueDates[b.id] ?? null
        return (
          <li key={b.id}>
            <Link
              href={`/admin/bursaries/${b.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 active:opacity-90"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">
                    {studentNames[b.student_id] ?? 'Unknown student'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{b.award_label}</p>
                </div>
                <BursaryStatusBadge status={b.status} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-tranmere-blue">
                  {formatAmount(Number(b.amount_per_period))}
                  <span className="font-normal text-muted-foreground">
                    {' '}/ {PERIOD_LABELS[b.period].toLowerCase()}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {nextDue ? `Next due ${formatDueDate(nextDue)}` : 'No payments due'}
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
