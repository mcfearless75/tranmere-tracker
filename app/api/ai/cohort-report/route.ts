import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import {
  aggregateCohort,
  buildCohortReportPrompt,
  type AttendanceRow,
  type CohortStudent,
  type GpsRow,
  type MatchRow,
  type WellbeingByStudent,
} from '@/lib/cohortReport/cohortReportUtils'
import type { SurveyResponse } from '@/lib/wellbeing/wellbeingUtils'

export const dynamic = 'force-dynamic'

type Cohort = 'all' | 'year1' | 'year2'

const ALLOWED_ROLES = ['admin', 'coach', 'teacher']
const COHORT_LABELS: Record<Cohort, string> = {
  all: 'All students',
  year1: 'Year 1',
  year2: 'Year 2',
}
const YEAR_FILTER: Record<Cohort, number | null> = {
  all: null,
  year1: 1,
  year2: 2,
}

function isCohort(value: unknown): value is Cohort {
  return value === 'all' || value === 'year1' || value === 'year2'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!ALLOWED_ROLES.includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as { cohort?: unknown }
    if (!isCohort(body.cohort)) {
      return NextResponse.json({ error: "cohort must be 'all', 'year1' or 'year2'" }, { status: 400 })
    }
    const cohort = body.cohort
    const yearGroup = YEAR_FILTER[cohort]

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // ----- Students in cohort -----
    let studentQuery = admin
      .from('users')
      .select('id, name, year_group')
      .eq('role', 'student')
    if (yearGroup !== null) studentQuery = studentQuery.eq('year_group', yearGroup)
    const { data: studentRows } = await studentQuery
    const students: CohortStudent[] = studentRows ?? []
    const studentIds = students.map(s => s.id)

    if (studentIds.length === 0) {
      const { stats, atRisk } = aggregateCohort({
        students,
        attendance: [],
        scheduledDays: 0,
        gps: [],
        matches: [],
        wellbeing: {},
      })
      const prompt = buildCohortReportPrompt(COHORT_LABELS[cohort], stats, atRisk)
      const anthropic = getAnthropic()
      const response = await anthropic.messages.create({
        model: MODELS.haiku,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      const summary = extractText(response)
      return NextResponse.json({ summary, cohort, generated_at: new Date().toISOString(), stats })
    }

    // ----- Parallel fetches -----
    const [
      { data: attendanceRows },
      { data: scheduledRows },
      { data: gpsRows },
      { data: matchRows },
      { data: surveyRows },
    ] = await Promise.all([
      admin
        .from('daily_attendance')
        .select('student_id, attendance_date, am_checked_at, pm_checked_at')
        .in('student_id', studentIds)
        .gte('attendance_date', since),
      admin
        .from('attendance_sessions')
        .select('scheduled_date')
        .gte('scheduled_date', since),
      admin
        .from('gps_sessions')
        .select('player_id, total_distance_m, max_speed_kmh, sprint_count, session_date')
        .in('player_id', studentIds)
        .gte('session_date', since),
      admin
        .from('match_logs')
        .select('student_id, goals, assists, coach_rating, self_rating, match_date')
        .in('student_id', studentIds)
        .gte('match_date', since),
      admin
        .from('wellbeing_surveys')
        .select('id, student_id, status, completed_at')
        .in('student_id', studentIds)
        .eq('status', 'completed')
        .gte('completed_at', since)
        .order('completed_at', { ascending: false }),
    ])

    const attendance: AttendanceRow[] = attendanceRows ?? []
    const gps: GpsRow[] = gpsRows ?? []
    const matches: MatchRow[] = matchRows ?? []

    // Distinct scheduled days in the window.
    const scheduledDays = new Set((scheduledRows ?? []).map(r => r.scheduled_date as string)).size

    // ----- Wellbeing: latest completed survey per student, then red flags -----
    const latestSurveyByStudent = new Map<string, string>()
    for (const s of surveyRows ?? []) {
      // surveyRows is ordered newest-first, so the first seen per student is latest.
      if (!latestSurveyByStudent.has(s.student_id)) {
        latestSurveyByStudent.set(s.student_id, s.id)
      }
    }

    const wellbeing: WellbeingByStudent = {}
    const surveyIds = Array.from(latestSurveyByStudent.values())
    if (surveyIds.length > 0) {
      const { data: responseRows } = await admin
        .from('wellbeing_responses')
        .select('survey_id, question_key, score')
        .in('survey_id', surveyIds)

      const responsesBySurvey = new Map<string, SurveyResponse[]>()
      for (const r of responseRows ?? []) {
        const list = responsesBySurvey.get(r.survey_id) ?? []
        list.push({ question_key: r.question_key, score: r.score })
        responsesBySurvey.set(r.survey_id, list)
      }
      for (const [studentId, surveyId] of latestSurveyByStudent) {
        wellbeing[studentId] = responsesBySurvey.get(surveyId) ?? []
      }
    }

    const { stats, atRisk } = aggregateCohort({
      students,
      attendance,
      scheduledDays,
      gps,
      matches,
      wellbeing,
    })

    const prompt = buildCohortReportPrompt(COHORT_LABELS[cohort], stats, atRisk)
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const summary = extractText(response)

    return NextResponse.json({ summary, cohort, generated_at: new Date().toISOString(), stats })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
