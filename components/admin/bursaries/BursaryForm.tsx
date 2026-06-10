'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BursaryPeriod,
  BURSARY_PERIODS,
  PERIOD_LABELS,
  formatAmount,
  formatDueDate,
  generatePaymentSchedule,
  scheduleSummary,
} from '@/lib/bursaries/bursaryUtils'

interface StudentOption {
  id: string
  name: string
}

interface BursaryFormProps {
  students: StudentOption[]
}

const PREVIEW_LIMIT = 6

export function BursaryForm({ students }: BursaryFormProps) {
  const router = useRouter()
  const [studentId, setStudentId] = useState('')
  const [awardLabel, setAwardLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<BursaryPeriod>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schedule = useMemo(() => {
    const parsedAmount = Number(amount)
    if (!startDate || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return []
    return generatePaymentSchedule(startDate, endDate || null, period, parsedAmount)
  }, [startDate, endDate, period, amount])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsedAmount = Number(amount)
    if (!studentId) {
      setError('Please select a student.')
      return
    }
    if (awardLabel.trim() === '') {
      setError('Please enter an award label.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter an amount greater than zero.')
      return
    }
    if (!startDate) {
      setError('Please choose a start date.')
      return
    }
    if (endDate && endDate < startDate) {
      setError('End date must be on or after the start date.')
      return
    }
    if (schedule.length === 0) {
      setError('These dates produce no scheduled payments.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/bursaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          award_label: awardLabel.trim(),
          amount_per_period: parsedAmount,
          period,
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Failed to create bursary.')
        return
      }

      const { bursary } = await res.json()
      router.push(`/admin/bursaries/${bursary.id}`)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold text-tranmere-blue">New bursary</h2>

      <div>
        <label htmlFor="bursary-student" className="mb-1 block text-sm font-medium text-gray-900">Student</label>
        <select
          id="bursary-student"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          required
        >
          <option value="">Select a student…</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="bursary-label" className="mb-1 block text-sm font-medium text-gray-900">Award label</label>
        <input
          id="bursary-label"
          type="text"
          value={awardLabel}
          onChange={e => setAwardLabel(e.target.value)}
          placeholder="e.g. Travel bursary 2026/27"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bursary-amount" className="mb-1 block text-sm font-medium text-gray-900">Amount (£)</label>
          <input
            id="bursary-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
            required
          />
        </div>
        <div>
          <label htmlFor="bursary-period" className="mb-1 block text-sm font-medium text-gray-900">Period</label>
          <select
            id="bursary-period"
            value={period}
            onChange={e => setPeriod(e.target.value as BursaryPeriod)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          >
            {BURSARY_PERIODS.map(p => (
              <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bursary-start" className="mb-1 block text-sm font-medium text-gray-900">Start date</label>
          <input
            id="bursary-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
            required
          />
        </div>
        <div>
          <label htmlFor="bursary-end" className="mb-1 block text-sm font-medium text-gray-900">End date (optional)</label>
          <input
            id="bursary-end"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
          />
        </div>
      </div>

      <div>
        <label htmlFor="bursary-notes" className="mb-1 block text-sm font-medium text-gray-900">Notes (optional)</label>
        <textarea
          id="bursary-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Any context for this award…"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      {schedule.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-900">
            Schedule preview — {scheduleSummary(schedule)}
          </p>
          <ul className="mt-2 space-y-1">
            {schedule.slice(0, PREVIEW_LIMIT).map(p => (
              <li key={p.due_date} className="flex items-center justify-between text-xs text-gray-700">
                <span>{formatDueDate(p.due_date)}</span>
                <span className="font-medium">{formatAmount(p.amount)}</span>
              </li>
            ))}
          </ul>
          {schedule.length > PREVIEW_LIMIT && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              + {schedule.length - PREVIEW_LIMIT} more payments
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-tranmere-blue px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Create bursary'}
      </button>
    </form>
  )
}
