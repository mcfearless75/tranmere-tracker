import {
  ConcernSeverity,
  ConcernStatus,
  SEVERITY_LABELS,
  STATUS_LABELS,
  severityClasses,
  statusClasses,
} from '@/lib/safeguarding/safeguardingUtils'

export function SeverityBadge({ severity }: { severity: ConcernSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${severityClasses(severity)}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  )
}

export function StatusBadge({ status }: { status: ConcernStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses(status)}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
