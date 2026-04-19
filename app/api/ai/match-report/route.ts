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

  const { matchId, coachNotes } = await request.json()
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  // Gather full match context
  const { data: match } = await admin
    .from('match_events')
    .select('match_date, opponent, location, home_score, away_score, status, notes')
    .eq('id', matchId)
    .single()

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const { data: squad } = await admin
    .from('match_squads')
    .select('status, position, coach_rating, coach_notes, goals, assists, minutes_played, yellow_card, red_card, users:player_id(name)')
    .eq('match_id', matchId)

  const played = (squad ?? []).filter(s => s.status === 'accepted')
  const scorers = played.filter(s => (s.goals ?? 0) > 0).map(s => `${(s.users as any)?.name} (${s.goals})`).join(', ') || 'none recorded'
  const assisters = played.filter(s => (s.assists ?? 0) > 0).map(s => `${(s.users as any)?.name} (${s.assists})`).join(', ') || 'none recorded'
  const topRated = [...played].filter(s => s.coach_rating).sort((a, b) => (b.coach_rating ?? 0) - (a.coach_rating ?? 0)).slice(0, 3)
    .map(s => `${(s.users as any)?.name} (${s.coach_rating}/10)${s.coach_notes ? ' — ' + s.coach_notes : ''}`).join('; ') || 'no ratings yet'
  const cards = played.filter(s => s.yellow_card || s.red_card)
    .map(s => `${(s.users as any)?.name} (${s.yellow_card ? 'YC' : ''}${s.red_card ? 'RC' : ''})`).join(', ') || 'none'

  const try_ = async () => {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are writing a post-match report for Tranmere Rovers academy. Write in British English, in the voice of the academy coach. Friendly but professional — suitable for parents, players and the head of academy. About 200-300 words. Do NOT invent facts; only use the data below.

MATCH DATA
- Date: ${match.match_date}
- Opponent: ${match.opponent}
- Venue: ${match.location ?? 'not specified'}
- Result: Tranmere ${match.home_score ?? '?'} – ${match.away_score ?? '?'} ${match.opponent}
- Squad played: ${played.length} players
- Scorers: ${scorers}
- Assists: ${assisters}
- Top performers: ${topRated}
- Cards: ${cards}
${coachNotes ? `\nCOACH'S NOTES / KEY MOMENTS:\n${coachNotes}` : ''}

Structure:
1. Opening line — result + how it played out
2. Key moments / goals / performances
3. Player highlights (by name)
4. Closing line about what this means for the squad or what's next

Return just the report text — no headings, no markdown, no quotes.`
      }],
    })
    return extractText(response)
  }

  try {
    const report = await try_()
    await admin.from('match_events').update({
      report_text: report,
      report_updated_at: new Date().toISOString(),
    }).eq('id', matchId)
    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 })
  }
}
