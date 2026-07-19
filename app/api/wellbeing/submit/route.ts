import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotificationToUser } from '@/lib/webpush'
import { validateSurveyAnswers, getRedFlags, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'

/**
 * Alert staff (admins, coaches, teachers) that a submission contained a
 * safeguarding red flag. Students and parents are never notified.
 * Best effort — errors are swallowed so the submission always succeeds.
 */
async function notifyStaffOfRedFlag(studentId: string): Promise<void> {
  try {
    const adminClient = createAdminClient()

    const { data: student } = await adminClient
      .from('users')
      .select('name')
      .eq('id', studentId)
      .maybeSingle()

    const { data: staff } = await adminClient
      .from('users')
      .select('id')
      .in('role', ['admin', 'coach', 'teacher'])
    if (!staff?.length) return

    const studentName = student?.name ?? 'A student'
    await Promise.allSettled(
      staff.map(s =>
        sendPushNotificationToUser(
          adminClient,
          s.id,
          'Wellbeing alert',
          `${studentName}'s latest wellbeing survey needs attention.`,
          '/admin/wellbeing',
        )
      )
    )
  } catch {
    // Never let notification failures affect the submission
  }
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { survey_id, answers, notes } = body as {
    survey_id: string
    answers: Record<string, number>
    notes: Record<string, string>
  }

  if (!survey_id || !answers) {
    return NextResponse.json({ error: 'survey_id and answers required' }, { status: 400 })
  }

  if (!validateSurveyAnswers(answers)) {
    return NextResponse.json({ error: 'All 5 questions must be answered with scores 1-5' }, { status: 400 })
  }

  // Verify this survey belongs to the current user and is still open
  const { data: survey } = await supabase
    .from('wellbeing_surveys')
    .select('id, status')
    .eq('id', survey_id)
    .eq('student_id', user.id)
    .eq('status', 'open')
    .maybeSingle()

  if (!survey) {
    return NextResponse.json({ error: 'Survey not found or already completed' }, { status: 404 })
  }

  // Insert responses
  const responses = SURVEY_QUESTIONS.map(q => ({
    survey_id,
    question_key: q.key,
    score: answers[q.key],
    note: notes?.[q.key] ?? null,
  }))

  const { error: insertErr } = await supabase
    .from('wellbeing_responses')
    .insert(responses)

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Mark survey complete
  await supabase
    .from('wellbeing_surveys')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', survey_id)

  // Red-flag check: awaited, not fire-and-forget — serverless suspends after the
  // response, so an unawaited safeguarding push can silently never send. The
  // helper swallows its own errors, so awaiting can never fail the submission.
  const redFlags = getRedFlags(
    SURVEY_QUESTIONS.map(q => ({ question_key: q.key, score: answers[q.key] }))
  )
  if (redFlags.length > 0) {
    await notifyStaffOfRedFlag(user.id)
  }

  return NextResponse.json({ success: true })
}
