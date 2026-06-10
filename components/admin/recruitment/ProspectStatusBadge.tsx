import { ProspectStatus, STATUS_META } from '@/lib/recruitment/recruitmentUtils'

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.label}
    </span>
  )
}
