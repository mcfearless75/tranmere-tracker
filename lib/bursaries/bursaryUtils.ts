export type BursaryPeriod = 'weekly' | 'monthly' | 'termly'

export type BursaryStatus = 'active' | 'suspended' | 'ended'

export type PaymentStatus = 'pending' | 'paid' | 'skipped'

export interface Bursary {
  id: string
  student_id: string
  award_label: string
  amount_per_period: number
  period: BursaryPeriod
  start_date: string
  end_date: string | null
  status: BursaryStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BursaryPayment {
  id: string
  bursary_id: string
  due_date: string
  amount: number
  status: PaymentStatus
  paid_at: string | null
  marked_by: string | null
  note: string | null
  created_at: string
}

export interface ScheduledPayment {
  due_date: string
  amount: number
}

export const BURSARY_PERIODS: BursaryPeriod[] = ['weekly', 'monthly', 'termly']

export const BURSARY_STATUSES: BursaryStatus[] = ['active', 'suspended', 'ended']

export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'skipped']

export const PERIOD_LABELS: Record<BursaryPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  termly: 'Termly',
}

export const BURSARY_STATUS_LABELS: Record<BursaryStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  ended: 'Ended',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  skipped: 'Skipped',
}

/** Tailwind classes for a bursary status badge. */
export function bursaryStatusClasses(status: BursaryStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'suspended':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'ended':
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

/** Tailwind classes for a payment status badge. */
export function paymentStatusClasses(status: PaymentStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'paid':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'skipped':
      return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

/** Type guards for validating untrusted request input. */
export function isBursaryPeriod(value: unknown): value is BursaryPeriod {
  return typeof value === 'string' && (BURSARY_PERIODS as string[]).includes(value)
}

export function isBursaryStatus(value: unknown): value is BursaryStatus {
  return typeof value === 'string' && (BURSARY_STATUSES as string[]).includes(value)
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as string[]).includes(value)
}

/** Validates a YYYY-MM-DD date string and that it parses to a real date. */
export function isISODateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

/** Number of months ahead to schedule when a bursary has no end date. */
export const OPEN_ENDED_HORIZON_MONTHS = 12

/** Term payment dates: 1 September, 1 January, 1 April (month index, day). */
const TERM_DATES: ReadonlyArray<readonly [number, number]> = [
  [8, 1], // 1 September
  [0, 1], // 1 January
  [3, 1], // 1 April
]

function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Adds calendar months, clamping the anchor day to the last day of the target
 * month (31 Jan + 1 month -> 28/29 Feb).
 */
function addMonthsClamped(start: Date, months: number): Date {
  const anchorDay = start.getUTCDate()
  const totalMonths = start.getUTCMonth() + months
  const year = start.getUTCFullYear() + Math.floor(totalMonths / 12)
  const monthIndex = ((totalMonths % 12) + 12) % 12
  const day = Math.min(anchorDay, daysInMonth(year, monthIndex))
  return new Date(Date.UTC(year, monthIndex, day))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Generates the payment schedule for a bursary.
 *
 * - weekly: every 7 days starting on startDate
 * - monthly: same day each calendar month, clamped to month end
 * - termly: every 1 September, 1 January and 1 April within the window
 *
 * With an endDate the schedule runs from startDate to endDate inclusive.
 * With a null endDate it covers the next OPEN_ENDED_HORIZON_MONTHS (12)
 * calendar months from startDate (exclusive horizon, so monthly yields
 * exactly 12 payments).
 */
export function generatePaymentSchedule(
  startDate: string,
  endDate: string | null,
  period: BursaryPeriod,
  amount: number,
): ScheduledPayment[] {
  if (!isISODateString(startDate)) return []
  if (endDate !== null && !isISODateString(endDate)) return []
  if (!Number.isFinite(amount) || amount <= 0) return []

  const start = parseISODate(startDate)
  const last = endDate
    ? parseISODate(endDate)
    : addDays(addMonthsClamped(start, OPEN_ENDED_HORIZON_MONTHS), -1)

  if (last.getTime() < start.getTime()) return []

  const perPayment = roundAmount(amount)
  const dueDates: string[] = []

  if (period === 'weekly') {
    for (let d = start; d.getTime() <= last.getTime(); d = addDays(d, 7)) {
      dueDates.push(toISODate(d))
    }
  } else if (period === 'monthly') {
    for (let i = 0; ; i += 1) {
      const due = addMonthsClamped(start, i)
      if (due.getTime() > last.getTime()) break
      dueDates.push(toISODate(due))
    }
  } else {
    for (let year = start.getUTCFullYear(); year <= last.getUTCFullYear(); year += 1) {
      for (const [monthIndex, day] of TERM_DATES) {
        const due = new Date(Date.UTC(year, monthIndex, day))
        if (due.getTime() >= start.getTime() && due.getTime() <= last.getTime()) {
          dueDates.push(toISODate(due))
        }
      }
    }
    dueDates.sort()
  }

  return dueDates.map(due_date => ({ due_date, amount: perPayment }))
}

/** Formats an amount as GBP with two decimal places, e.g. £1,250.00. */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Total of payments already marked as paid. */
export function paidToDate(payments: Pick<BursaryPayment, 'status' | 'amount'>[]): number {
  return roundAmount(
    payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0),
  )
}

/** Total of payments still scheduled (pending). */
export function remainingScheduled(
  payments: Pick<BursaryPayment, 'status' | 'amount'>[],
): number {
  return roundAmount(
    payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0),
  )
}

/** Earliest pending due date, or null when nothing is outstanding. */
export function nextDueDate(
  payments: Pick<BursaryPayment, 'status' | 'due_date'>[],
): string | null {
  const pending = payments
    .filter(p => p.status === 'pending')
    .map(p => p.due_date)
    .sort()
  return pending[0] ?? null
}

/** One-line summary of a generated schedule, e.g. "12 payments of £40.00 (£480.00 total)". */
export function scheduleSummary(schedule: ScheduledPayment[]): string {
  if (schedule.length === 0) return 'No payments scheduled'
  const total = roundAmount(schedule.reduce((sum, p) => sum + p.amount, 0))
  const plural = schedule.length === 1 ? 'payment' : 'payments'
  return `${schedule.length} ${plural} of ${formatAmount(schedule[0].amount)} (${formatAmount(total)} total)`
}

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Formats a YYYY-MM-DD date for display, e.g. "1 Sep 2026". */
export function formatDueDate(iso: string): string {
  if (!isISODateString(iso)) return iso
  const date = parseISODate(iso)
  return `${date.getUTCDate()} ${MONTH_ABBREVIATIONS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}
