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
  const { data: profile } = await admin.from('users').select('role, name').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { brief } = await request.json()
  if (!brief?.trim()) return NextResponse.json({ error: 'brief required' }, { status: 400 })

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are writing a broadcast message for Tranmere Rovers FC youth academy staff.
The sender is ${profile.name ?? 'the coaching team'} (${profile.role}).

Brief/notes from the coach:
"${brief}"

Write a clear, professional broadcast message suitable for all squad members.
- Friendly but direct tone
- Include all key details from the brief
- 3–6 sentences max
- No emojis unless the brief mentions them
- Return ONLY the message text, nothing else`
      }],
    })

    return NextResponse.json({ message: extractText(response) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
