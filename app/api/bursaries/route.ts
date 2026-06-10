import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generatePaymentSchedule,
  isBursaryPeriod,
  isISODateString,
} from '@/lib/bursaries/bursaryUtils'

export const dynamic = 'force-dynamic'

/** Maximum amount storable in numeric(8,2). */
const MAX_AMOUNT = 999999.99

/**
 * Verifies the requester is an authenticated admin (strictly role='admin' —
 * bursaries hold financial data, so staff roles are not enough).
 * Returns the user id or null.
 */
async function requireAdmin(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') return null
  return user.id
}

export async function POST(request: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    student_id: studentId,
    award_label: awardLabel,
    amount_per_period: amountPerPeriod,
    period,
    start_date: startDate,
    end_date: endDate,
    notes,
  } = (body ?? {}) as Record<string, unknown>

  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 })
  }
  if (typeof awardLabel !== 'string' || awardLabel.trim() === '') {
    return NextResponse.json({ error: 'award_label is required' }, { status: 400 })
  }
  if (
    typeof amountPerPeriod !== 'number' ||
    !Number.isFinite(amountPerPeriod) ||
    amountPerPeriod <= 0 ||
    amountPerPeriod > MAX_AMOUNT
  ) {
    return NextResponse.json({ error: 'amount_per_period is invalid' }, { status: 400 })
  }
  if (!isBursaryPeriod(period)) {
    return NextResponse.json({ error: 'period is invalid' }, { status: 400 })
  }
  if (!isISODateString(startDate)) {
    return NextResponse.json({ error: 'start_date is invalid' }, { status: 400 })
  }
  const normalisedEndDate = endDate === undefined || endDate === null || endDate === '' ? null : endDate
  if (normalisedEndDate !== null && !isISODateString(normalisedEndDate)) {
    return NextResponse.json({ error: 'end_date is invalid' }, { status: 400 })
  }
  if (normalisedEndDate !== null && normalisedEndDate < startDate) {
    return NextResponse.json({ error: 'end_date must be on or after start_date' }, { status: 400 })
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return NextResponse.json({ error: 'notes is invalid' }, { status: 400 })
  }

  const schedule = generatePaymentSchedule(startDate, normalisedEndDate, period, amountPerPeriod)
  if (schedule.length === 0) {
    return NextResponse.json(
      { error: 'The supplied dates produce no scheduled payments' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  const { data: bursary, error: bursaryError } = await admin
    .from('bursaries')
    .insert({
      student_id: studentId,
      award_label: awardLabel.trim(),
      amount_per_period: amountPerPeriod,
      period,
      start_date: startDate,
      end_date: normalisedEndDate,
      status: 'active',
      notes: typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null,
    })
    .select()
    .single()

  if (bursaryError || !bursary) {
    return NextResponse.json(
      { error: bursaryError?.message ?? 'Failed to create bursary' },
      { status: 500 },
    )
  }

  const { error: paymentsError } = await admin.from('bursary_payments').insert(
    schedule.map(p => ({
      bursary_id: bursary.id as string,
      due_date: p.due_date,
      amount: p.amount,
      status: 'pending',
    })),
  )

  if (paymentsError) {
    // Roll back the bursary so we never leave an award without its schedule.
    await admin.from('bursaries').delete().eq('id', bursary.id as string)
    return NextResponse.json({ error: paymentsError.message }, { status: 500 })
  }

  return NextResponse.json({ bursary, paymentCount: schedule.length }, { status: 201 })
}
