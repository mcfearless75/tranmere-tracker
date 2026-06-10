'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bursary,
  BursaryPayment,
  BursaryStatus,
  PaymentStatus,
  BURSARY_STATUSES,
  BURSARY_STATUS_LABELS,
  PERIOD_LABELS,
  formatAmount,
  formatDueDate,
  paidToDate,
  remainingScheduled,
} from '@/lib/bursaries/bursaryUtils'
import { BursaryStatusBadge, PaymentStatusBadge } from './BursaryBadges'

interface BursaryDetailProps {
  bursary: Bursary
  payments: BursaryPayment[]
  studentName: string
  markerNames: Record<string, string>
}

export function BursaryDetail({ bursary, payments, studentName, markerNames }: BursaryDetailProps) {
  const router = useRouter()
  const [status, setStatus] = useState<BursaryStatus>(bursary.status)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const totalPaid = paidToDate(payments)
  const totalRemaining = remainingScheduled(payments)

  async function handleStatusChange(next: BursaryStatus) {
    setStatus(next)
    setStatusError(null)
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/bursaries/${bursary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus(bursary.status)
        setStatusError(typeof data.error === 'string' ? data.error : 'Failed to update status.')
        return
      }
      router.refresh()
    } catch {
      setStatus(bursary.status)
      setStatusError('Network error — please try again.')
    } finally {
      setSavingStatus(false)
    }
  }

  async function handlePaymentStatus(paymentId: string, next: PaymentStatus) {
    setPaymentError(null)
    setUpdatingPaymentId(paymentId)
    try {
      const res = await fetch(`/api/bursaries/${bursary.id}/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPaymentError(typeof data.error === 'string' ? data.error : 'Failed to update payment.')
        return
      }
      router.refresh()
    } catch {
      setPaymentError('Network error — please try again.')
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Bursary summary */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">{studentName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{bursary.award_label}</p>
          </div>
          <BursaryStatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Amount per period</p>
            <p className="font-semibold text-gray-900">
              {formatAmount(Number(bursary.amount_per_period))} / {PERIOD_LABELS[bursary.period].toLowerCase()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Runs</p>
            <p className="font-semibold text-gray-900">
              {formatDueDate(bursary.start_date)}
              {' – '}
              {bursary.end_date ? formatDueDate(bursary.end_date) : 'open ended'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid to date</p>
            <p className="font-semibold text-emerald-700">{formatAmount(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining scheduled</p>
            <p className="font-semibold text-tranmere-blue">{formatAmount(totalRemaining)}</p>
          </div>
        </div>
        {bursary.notes && (
          <p className="whitespace-pre-wrap text-sm text-gray-700">{bursary.notes}</p>
        )}
      </div>

      {/* Status update */}
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
        <label htmlFor="bursary-status" className="block text-sm font-semibold text-gray-900">
          Update status
        </label>
        <select
          id="bursary-status"
          value={status}
          disabled={savingStatus}
          onChange={e => handleStatusChange(e.target.value as BursaryStatus)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 disabled:opacity-50"
        >
          {BURSARY_STATUSES.map(s => (
            <option key={s} value={s}>{BURSARY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        {statusError && <p className="text-xs text-red-600">{statusError}</p>}
      </div>

      {/* Payment schedule */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-tranmere-blue">Payment schedule</h2>
        {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments scheduled.</p>
        ) : (
          <ol className="space-y-2">
            {payments.map(p => {
              const busy = updatingPaymentId === p.id
              return (
                <li key={p.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{formatDueDate(p.due_date)}</p>
                      <p className="text-xs text-muted-foreground">{formatAmount(Number(p.amount))}</p>
                    </div>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  {p.status !== 'pending' && p.marked_by && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Marked by {markerNames[p.marked_by] ?? 'Staff'}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    {p.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePaymentStatus(p.id, 'paid')}
                          className="rounded-xl bg-tranmere-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handlePaymentStatus(p.id, 'skipped')}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handlePaymentStatus(p.id, 'pending')}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                      >
                        Revert to pending
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
