import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTerm } from '@/lib/reviews/scheduleUtils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const currentTerm = getCurrentTerm(now)

  // Fetch all active students
  const { data: students, error: studentsErr } = await admin
    .from('users')
    .select('id')
    .eq('role', 'student')

  if (studentsErr) {
    return NextResponse.json({ error: studentsErr.message }, { status: 500 })
  }

  if (!students?.length) {
    return NextResponse.json({ created: 0, skipped: 0, reason: 'no students found' })
  }

  // Fetch existing reviews for this term
  const studentIds = students.map(s => s.id)

  const { data: existingReviews, error: reviewsErr } = await admin
    .from('learner_reviews')
    .select('student_id, term')
    .eq('term', currentTerm)
    .in('student_id', studentIds)

  if (reviewsErr) {
    return NextResponse.json({ error: reviewsErr.message }, { status: 500 })
  }

  const alreadyScheduled = new Set((existingReviews ?? []).map(r => r.student_id))

  const toCreate = students.filter(s => !alreadyScheduled.has(s.id))

  if (!toCreate.length) {
    return NextResponse.json({
      created: 0,
      skipped: students.length,
      term: currentTerm,
    })
  }

  const { error: insertErr } = await admin
    .from('learner_reviews')
    .insert(
      toCreate.map(s => ({
        student_id: s.id,
        term: currentTerm,
        status: 'draft' as const,
      }))
    )

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    created: toCreate.length,
    skipped: alreadyScheduled.size,
    term: currentTerm,
  })
}
