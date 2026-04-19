import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GRADE_SCORE: Record<string, number> = { Distinction: 3, Merit: 2, Pass: 1, Refer: 0 }

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentIds, metrics } = await request.json()
  if (!Array.isArray(studentIds) || !Array.isArray(metrics)) {
    return NextResponse.json({ error: 'studentIds and metrics required' }, { status: 400 })
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [
    { data: students },
    { data: assignments },
    { data: submissions },
    { data: gps },
    { data: matches },
    { data: nutrition },
    { data: training },
  ] = await Promise.all([
    admin.from('users').select('id, name, role, course_id, courses(name)').in('id', studentIds),
    admin.from('assignments').select('id, unit_id, btec_units(course_id)'),
    admin.from('submissions').select('student_id, assignment_id, status, grade').in('student_id', studentIds),
    admin.from('gps_sessions').select('player_id, session_date, total_distance_m, max_speed_kmh, sprint_count').in('player_id', studentIds).gte('session_date', since),
    admin.from('match_logs').select('student_id, match_date, goals, assists, self_rating').in('student_id', studentIds).gte('match_date', since),
    admin.from('nutrition_logs').select('student_id, logged_date').in('student_id', studentIds).gte('logged_date', since),
    admin.from('training_logs').select('student_id, session_date').in('student_id', studentIds).gte('session_date', since),
  ])

  const rows = (students ?? []).map(s => {
    const row: Record<string, any> = {
      id: s.id,
      Student: s.name ?? '',
      Role: s.role,
      Course: (s.courses as any)?.name ?? '',
    }

    const courseAssignments = (assignments ?? []).filter(a =>
      (a.btec_units as any)?.course_id === s.course_id
    )
    const subs = (submissions ?? []).filter(sb => sb.student_id === s.id)
    const pGps = (gps ?? []).filter(g => g.player_id === s.id)
    const pMatches = (matches ?? []).filter(m => m.student_id === s.id)

    if (metrics.includes('coursework')) {
      const submitted = subs.filter(sb => ['submitted', 'graded'].includes(sb.status)).length
      row['Coursework %'] = courseAssignments.length > 0
        ? Math.round((submitted / courseAssignments.length) * 100)
        : 0
    }
    if (metrics.includes('avgGrade')) {
      const graded = subs.filter(sb => sb.grade)
      row['Avg Grade'] = graded.length > 0
        ? +(graded.reduce((sum, g) => sum + (GRADE_SCORE[g.grade!] ?? 0), 0) / graded.length).toFixed(2)
        : ''
    }
    if (metrics.includes('gps')) {
      row['GPS Sessions (30d)'] = pGps.length
    }
    if (metrics.includes('distance')) {
      row['Distance (km)'] = +(pGps.reduce((sum, g) => sum + (g.total_distance_m ?? 0), 0) / 1000).toFixed(2)
    }
    if (metrics.includes('topSpeed')) {
      row['Max Speed (km/h)'] = Math.max(0, ...pGps.map(g => g.max_speed_kmh ?? 0)).toFixed(1)
    }
    if (metrics.includes('sprints')) {
      row['Sprints (30d)'] = pGps.reduce((sum, g) => sum + (g.sprint_count ?? 0), 0)
    }
    if (metrics.includes('matches')) {
      row['Matches (30d)'] = pMatches.length
    }
    if (metrics.includes('goals')) {
      row['Goals'] = pMatches.reduce((sum, m) => sum + m.goals, 0)
    }
    if (metrics.includes('assists')) {
      row['Assists'] = pMatches.reduce((sum, m) => sum + m.assists, 0)
    }
    if (metrics.includes('avgRating')) {
      const rated = pMatches.filter(m => m.self_rating)
      row['Avg Rating'] = rated.length > 0
        ? +(rated.reduce((sum, m) => sum + (m.self_rating ?? 0), 0) / rated.length).toFixed(1)
        : ''
    }
    if (metrics.includes('nutrition')) {
      row['Nutrition Logs (30d)'] = (nutrition ?? []).filter(n => n.student_id === s.id).length
    }
    if (metrics.includes('training')) {
      row['Training Logs (30d)'] = (training ?? []).filter(t => t.student_id === s.id).length
    }

    return row
  })

  return NextResponse.json({ rows })
}
