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

  const { studentId } = await request.json()
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [
    { data: student },
    { data: assignments },
    { data: submissions },
    { data: gps },
    { data: matches },
    { data: nutrition },
    { data: training },
  ] = await Promise.all([
    admin.from('users').select('name, courses(name)').eq('id', studentId).single(),
    admin.from('assignments').select('id, due_date, btec_units(course_id)'),
    admin.from('submissions').select('assignment_id, status, grade').eq('student_id', studentId),
    admin.from('gps_sessions').select('session_date, total_distance_m, max_speed_kmh, sprint_count, player_load').eq('player_id', studentId).gte('session_date', since).order('session_date', { ascending: false }),
    admin.from('match_squads').select('match_events(match_date, opponent), coach_rating, goals, assists').eq('player_id', studentId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(10),
    admin.from('nutrition_logs').select('logged_date').eq('student_id', studentId).gte('logged_date', since),
    admin.from('training_logs').select('session_date, session_type, intensity').eq('student_id', studentId).gte('session_date', since),
  ])

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Compute quick stats
  const subs = submissions ?? []
  const courseAssignments = (assignments ?? []).filter(a => {
    return (a.btec_units as any)?.course_id === (student as any).course_id
  })
  const submitted = subs.filter(s => ['submitted', 'graded'].includes(s.status)).length
  const graded = subs.filter(s => s.grade)
  const today = new Date().toISOString().slice(0, 10)
  const overdue = courseAssignments.filter(a => a.due_date < today && !subs.find(sub => sub.assignment_id === a.id && ['submitted', 'graded'].includes(sub.status))).length

  const gpsCount = gps?.length ?? 0
  const avgDist = gpsCount > 0 ? (gps!.reduce((s, g) => s + (g.total_distance_m ?? 0), 0) / gpsCount / 1000).toFixed(2) : 'n/a'
  const maxSpeed = gpsCount > 0 ? Math.max(...gps!.map(g => g.max_speed_kmh ?? 0)).toFixed(1) : 'n/a'

  const matchRatings = (matches ?? []).filter(m => m.coach_rating).map(m => m.coach_rating!)
  const avgMatch = matchRatings.length > 0 ? (matchRatings.reduce((a, b) => a + b, 0) / matchRatings.length).toFixed(1) : 'n/a'
  const totalGoals = (matches ?? []).reduce((s, m) => s + (m.goals ?? 0), 0)
  const totalAssists = (matches ?? []).reduce((s, m) => s + (m.assists ?? 0), 0)

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are an academy coach advisor at Tranmere Rovers. Write 3 concise, actionable insight bullets (≤25 words each) about this student's last 30 days. British English, direct, specific. No hedging. If a metric is missing, skip it rather than saying "no data".

STUDENT: ${(student as any).name} — ${(student.courses as any)?.name ?? 'No course'}

COURSEWORK
- Submitted: ${submitted}/${courseAssignments.length}
- Graded: ${graded.length} (${graded.map(g => g.grade).join(', ') || 'none'})
- Overdue: ${overdue}

GPS (30 days)
- Sessions: ${gpsCount}
- Avg distance: ${avgDist} km
- Top speed: ${maxSpeed} km/h

MATCHES (last 10)
- Played: ${matches?.length ?? 0}
- Avg coach rating: ${avgMatch}/10
- Goals: ${totalGoals}, Assists: ${totalAssists}

ENGAGEMENT
- Nutrition logs: ${nutrition?.length ?? 0} in 30d
- Training logs: ${training?.length ?? 0} in 30d

Output 3 bullets only, each starting with "• ". No intro text, no outro. Prioritise: 1) one strength worth celebrating 2) one risk/gap 3) one concrete next action.`
      }],
    })
    const text = extractText(response)
    return NextResponse.json({ success: true, insights: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 })
  }
}
