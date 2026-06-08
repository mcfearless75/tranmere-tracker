import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { buildReviewSummaryPrompt } from '@/lib/learnerReview/reviewUtils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const admin = createAdminClient()

    // Admins only
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'coach', 'teacher'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      review_id: string
      student_id: string
      student_name: string
      term: string
      answers: Record<string, string | number>
    }

    const { review_id, student_id, student_name, term, answers } = body
    if (!review_id || !student_id || !student_name || !term || !answers) {
      return NextResponse.json({ error: 'review_id, student_id, student_name, term, answers required' }, { status: 400 })
    }

    // Pull attendance stats for context
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: attendance } = await admin
      .from('daily_attendance')
      .select('attended, scheduled')
      .eq('student_id', student_id)
      .gte('date', thirtyDaysAgo)

    let attendancePct: number | undefined
    if (attendance && attendance.length > 0) {
      const totalScheduled = attendance.reduce((s, r) => s + (r.scheduled ? 1 : 0), 0)
      const totalAttended  = attendance.reduce((s, r) => s + (r.attended  ? 1 : 0), 0)
      if (totalScheduled > 0) attendancePct = Math.round((totalAttended / totalScheduled) * 100)
    }

    // Pull coursework stats
    const { data: submissions } = await admin
      .from('submissions')
      .select('status')
      .eq('student_id', student_id)

    const submittedUnits = (submissions ?? []).filter(s => ['submitted', 'graded'].includes(s.status)).length
    const totalUnits     = (submissions ?? []).length

    // Pull latest wellbeing scores
    const { data: wellbeingSurvey } = await admin
      .from('wellbeing_surveys')
      .select('id')
      .eq('student_id', student_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let wellbeingScores: Record<string, number> | undefined
    if (wellbeingSurvey) {
      const { data: wResponses } = await admin
        .from('wellbeing_responses')
        .select('question_key, score')
        .eq('survey_id', wellbeingSurvey.id)
      if (wResponses?.length) {
        wellbeingScores = Object.fromEntries(wResponses.map(r => [r.question_key, r.score]))
      }
    }

    const prompt = buildReviewSummaryPrompt(student_name, term, answers, {
      attendancePct,
      submittedUnits,
      totalUnits,
      wellbeingScores,
    })

    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: 'You are an experienced football academy coach and educator. Write professional, supportive, and specific learner reviews. Be encouraging but honest. Use British English.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const summaryText = message.content[0].type === 'text' ? message.content[0].text : ''
    const summaryJson = {
      text: summaryText,
      generated_at: new Date().toISOString(),
      context: { attendancePct, submittedUnits, totalUnits },
    }

    // Persist to the review row
    const { error: updateErr } = await admin
      .from('learner_reviews')
      .update({ ai_summary: summaryJson })
      .eq('id', review_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ summary: summaryJson })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
