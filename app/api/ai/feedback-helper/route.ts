import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { assignmentTitle, roughNotes, grade, gradeTarget, studentName } = await request.json()
  if (!roughNotes?.trim()) return NextResponse.json({ error: 'roughNotes required' }, { status: 400 })

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a BTEC Sport teacher writing student feedback. Polish the teacher's rough notes into professional, constructive feedback suitable for a 16-18 year old BTEC student. British English.

Requirements:
- Warm but honest tone
- Specific and actionable
- 3-5 sentences
- Justify the grade if one is given
- If the grade is below Distinction, end with one concrete step to reach the next grade
- NO filler like "Well done!" at the start — get straight to the point
- Do NOT invent specific details not in the notes

STUDENT: ${studentName ?? 'the student'}
ASSIGNMENT: ${assignmentTitle ?? '(not specified)'}
GRADE TARGET: ${gradeTarget ?? 'not set'}
GRADE AWARDED: ${grade ?? 'not graded yet'}

TEACHER'S ROUGH NOTES:
${roughNotes}

Output the polished feedback as plain text — no headings, no markdown, no quote marks.`
      }],
    })
    const text = extractText(response)
    return NextResponse.json({ success: true, feedback: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 })
  }
}
