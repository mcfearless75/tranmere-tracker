import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { unitName, courseName, unitNumber } = await req.json()
  if (!unitName) return NextResponse.json({ error: 'unitName required' }, { status: 400 })

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a BTEC Sports/PE curriculum expert. Generate 3 assignment ideas for a BTEC unit.

Unit: ${unitNumber ? `Unit ${unitNumber}: ` : ''}${unitName}
Course: ${courseName ?? 'BTEC Sport'}

For each assignment return a JSON object with: title, description (1-2 sentences, practical and sport-focused), gradeTarget (Pass/Merit/Distinction).

Respond with ONLY a JSON array of 3 objects, no markdown, no explanation.
Example: [{"title":"...","description":"...","gradeTarget":"Merit"},...]`
      }],
    })

    const text = extractText(response)
    const suggestions = JSON.parse(text)
    return NextResponse.json({ suggestions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
