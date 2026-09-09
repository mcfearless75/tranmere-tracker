import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { detectDistressSignals } from '@/lib/safeguarding/distressDetection'
import { autoRaiseConcern } from '@/lib/safeguarding/autoRaiseConcern'
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
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify bot room
  const { data: room } = await admin.from('chat_rooms').select('kind').eq('id', roomId).maybeSingle()
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

  const latestUserMessage = claudeMessages[claudeMessages.length - 1].content

  // Fetch student profile for context
  const { data: profile } = await admin
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()

  try {
    const anthropic = getAnthropic()

    // Safeguarding safety net: detection runs independently of the AI's own
    // reply, so a human is notified regardless of what Claude says. Awaited
    // alongside the Claude call (not fire-and-forget) — a serverless
    // function suspends the instant the response is returned, so an
    // un-awaited notification can silently never send. Best-effort —
    // autoRaiseConcern never throws, so it can never fail the chat reply.
    const signals = detectDistressSignals(latestUserMessage)
    const escalationPromise = signals.length > 0
      ? autoRaiseConcern(admin, {
          studentId: user.id,
          category: 'wellbeing',
          severity: 'high',
          description:
            `Auto-detected by the AI Coach chat: a message from ${profile?.name ?? 'this student'} ` +
            `matched distress signals (${signals.join(', ')}). Review the conversation in the ` +
            `student's chat and follow up directly — the AI's reply to the student is not a ` +
            `substitute for a welfare check.`,
          notifyTitle: `⚠️ Possible distress signal: ${profile?.name ?? 'A student'}`,
          notifyBody: 'A message in the AI Coach chat matched distress signals. Please review and follow up.',
          notifyUrl: `/chat/${roomId}`,
        })
      : Promise.resolve({ raised: false })

    // Use allSettled (not all) so a Claude-call rejection can never cut the escalation's
    // own async work short: allSettled always waits for BOTH promises to settle before we
    // decide whether to throw, so the safeguarding notification still completes even when
    // the Claude API call fails (timeout, rate limit, transient 5xx).
    const [claudeResult] = await Promise.allSettled([
      anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 512,
        system: `You are the AI Coach for Tranmere Rovers Football Academy. You help student athletes with training advice, nutrition, coursework, motivation, and personal development. Be encouraging, direct, and practical. Use British English. Keep replies concise — 2-4 sentences unless the student asks for more detail. The student's name is ${profile?.name ?? 'the student'}.

If a message shows signs of real distress — self-harm, suicidal thoughts, abuse, or feeling hopeless or unsafe — respond with empathy first. Do not try to diagnose or handle it yourself. Gently encourage them to talk to a coach, teacher, or another trusted adult at the academy, and mention Childline (0800 1111) or Samaritans (116 123) as someone they can talk to any time, or 999 if they're in immediate danger. Keep this brief and caring, not a lecture. For every other message, respond normally as above.`,
        messages: claudeMessages,
      }),
      escalationPromise,
    ])
    if (claudeResult.status === 'rejected') throw claudeResult.reason

    const reply = extractText(claudeResult.value)

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
