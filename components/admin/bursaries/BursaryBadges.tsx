import {
  BursaryStatus,
  PaymentStatus,
  BURSARY_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  bursaryStatusClasses,
  paymentStatusClasses,
} from '@/lib/bursaries/bursaryUtils'

export function BursaryStatusBadge({ status }: { status: BursaryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${bursaryStatusClasses(status)}`}
    >
      {BURSARY_STATUS_LABELS[status]}
    </span>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${paymentStatusClasses(status)}`}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}
