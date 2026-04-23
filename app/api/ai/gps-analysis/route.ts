import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const { data: sessions } = await admin
    .from('gps_sessions')
    .select('player_id, total_distance_m, max_speed_kmh, sprint_count, player_load, session_date, session_label, users:player_id(name)')
    .gte('session_date', weekAgo)
    .order('session_date', { ascending: false })

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ error: 'No GPS data in the last 7 days to analyse.' }, { status: 400 })
  }

  // Aggregate by player
  const byPlayer: Record<string, { name: string; sessions: number; totalDistance: number; maxSpeed: number; totalSprints: number; totalLoad: number }> = {}
  for (const s of sessions) {
    const name = (s.users as any)?.name ?? 'Unknown'
    const id = s.player_id
    if (!byPlayer[id]) byPlayer[id] = { name, sessions: 0, totalDistance: 0, maxSpeed: 0, totalSprints: 0, totalLoad: 0 }
    byPlayer[id].sessions++
    byPlayer[id].totalDistance += s.total_distance_m ?? 0
    byPlayer[id].maxSpeed = Math.max(byPlayer[id].maxSpeed, s.max_speed_kmh ?? 0)
    byPlayer[id].totalSprints += s.sprint_count ?? 0
    byPlayer[id].totalLoad += s.player_load ?? 0
  }

  const playerLines = Object.values(byPlayer).map(p =>
    `${p.name}: ${p.sessions} session(s), ${(p.totalDistance / 1000).toFixed(2)}km total, top speed ${p.maxSpeed.toFixed(1)}km/h, ${p.totalSprints} sprints, load ${p.totalLoad.toFixed(0)}`
  ).join('\n')

  const avgLoad = Object.values(byPlayer).reduce((sum, p) => sum + p.totalLoad, 0) / Object.values(byPlayer).length

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are an elite sports science analyst for Tranmere Rovers FC youth academy.
Analyse this GPS data from the last 7 days and give the coaching staff a concise, actionable report.

SQUAD GPS DATA (last 7 days):
${playerLines}

Squad average player load: ${avgLoad.toFixed(0)}

Write a structured plain-text report (no markdown headers, no bullet symbols) covering:
1. Top performers this week (distance, speed, work rate)
2. Any players with unusually high load (injury risk — flag clearly)
3. Any players with very low output (fitness concern or lack of match sharpness)
4. One or two specific training recommendations for next session
5. Overall squad readiness rating out of 10 with brief justification

Keep it under 250 words. Be direct, specific and use player names.`
      }],
    })

    return NextResponse.json({ analysis: extractText(response) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
