import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId } = await request.json()
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify membership
  const { data: member } = await admin
    .from('chat_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify bot room
  const { data: room } = await admin.from('chat_rooms').select('kind').eq('id', roomId).single()
  if (!room || room.kind !== 'bot') return NextResponse.json({ error: 'Not a bot room' }, { status: 400 })

  // Get recent message history (last 20)
  const { data: msgs } = await admin
    .from('chat_messages')
    .select('sender_id, body')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const history = (msgs ?? []).reverse()

  // Build Claude message history
  const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of history) {
    if (!m.body) continue
    if (m.sender_id === BOT_USER_ID) {
      claudeMessages.push({ role: 'assistant', content: m.body })
    } else {
      claudeMessages.push({ role: 'user', content: m.body })
    }
  }

  // Ensure last message is from user
  if (!claudeMessages.length || claudeMessages[claudeMessages.length - 1].role !== 'user') {
    return NextResponse.json({ ok: true })
  }

  // Fetch student profile for context
  const { data: profile } = await admin
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 512,
      system: `You are the AI Coach for Tranmere Rovers Football Academy. You help student athletes with training advice, nutrition, coursework, motivation, and personal development. Be encouraging, direct, and practical. Use British English. Keep replies concise — 2-4 sentences unless the student asks for more detail. The student's name is ${profile?.name ?? 'the student'}.`,
      messages: claudeMessages,
    })

    const reply = extractText(response)

    // Insert bot reply
    await admin.from('chat_messages').insert({
      room_id: roomId,
      sender_id: BOT_USER_ID,
      body: reply,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 })
  }
}
