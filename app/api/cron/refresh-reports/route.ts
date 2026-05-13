// Vercel Cron: 02:00 daily — regenerates stale AI reports for active players,
// then pushes a notification if high-priority development areas were found.
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── shared helpers ──────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function buildSessionBreakdown(logs: { session_type: string }[]): string {
  const counts: Record<string, number> = {}
  for (const log of logs) {
    const t = log.session_type ?? 'unknown'
    counts[t] = (counts[t] ?? 0) + 1
  }
  return Object.entries(counts).map(([type, count]) => `${count}x ${type}`).join(', ') || 'None'
}

function calculateAge(dob: string | null): string {
  if (!dob) return 'Unknown'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return String(age)
}

function calculateBmi(h: number | null, w: number | null): string {
  if (!h || !w) return 'Unknown'
  return (w / Math.pow(h / 100, 2)).toFixed(1)
}

// ─── per-player report generation ────────────────────────────────────────────

interface ReportDevelopmentArea {
  area: string
  priority: 'high' | 'medium' | 'low'
  position_relevance: string
  this_week_action: string
}

interface GeneratedReport {
  headline: string
  overall_rating: string
  strengths: { label: string; detail: string }[]
  development_areas: ReportDevelopmentArea[]
  training_plan: Record<string, unknown>
  nutrition_plan: Record<string, unknown>
  gps_targets: Record<string, unknown>
  position_insight: string
  this_week_priority: string
}

async function generateReportForStudent(
  studentId: string,
): Promise<GeneratedReport | null> {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [profileRes, trainingRes, nutritionRes, nutritionGoalRes, gpsRes, matchRes] =
    await Promise.all([
      admin.from('users').select('name, position, height_cm, weight_kg, build, dominant_foot, date_of_birth').eq('id', studentId).single(),
      admin.from('training_logs').select('session_type, session_date, duration_mins').eq('student_id', studentId).gte('session_date', thirtyDaysAgo),
      admin.from('nutrition_logs').select('calories, protein_g, carbs_g, fat_g, logged_date').eq('student_id', studentId).gte('logged_date', fourteenDaysAgo),
      admin.from('nutrition_goals').select('calories, protein_g, carbs_g, fat_g').eq('student_id', studentId).maybeSingle(),
      admin.from('gps_sessions').select('total_distance_m, hsr_distance_m, max_speed_kmh, sprint_count, player_load').eq('player_id', studentId).order('session_date', { ascending: false }).limit(10),
      admin.from('match_squads').select('coach_rating, status').eq('player_id', studentId).order('created_at', { ascending: false }).limit(5),
    ])

  const profile = profileRes.data ?? {}
  const training = trainingRes.data ?? []
  const nutrition = nutritionRes.data ?? []
  const goal = nutritionGoalRes.data
  const gps = gpsRes.data ?? []
  const matches = matchRes.data ?? []

  // Skip if no meaningful data at all
  if (training.length === 0 && nutrition.length === 0 && gps.length === 0) return null

  const position = (profile as Record<string, unknown>).position as string ?? 'Not set'
  const totalMins = training.reduce((s: number, l: { duration_mins: number }) => s + (l.duration_mins ?? 0), 0)
  const avgMins = training.length > 0 ? Math.round(totalMins / training.length) : 0
  const daysNutrition = new Set(nutrition.map((l: { logged_date: string }) => l.logged_date)).size
  const avgCal = Math.round(avg(nutrition.map((l: { calories: number }) => l.calories ?? 0)))
  const avgProtein = Math.round(avg(nutrition.map((l: { protein_g: number }) => l.protein_g ?? 0)))
  const avgCarbs = Math.round(avg(nutrition.map((l: { carbs_g: number }) => l.carbs_g ?? 0)))
  const targetCal = (goal as { calories: number } | null)?.calories ?? 0
  const targetProtein = (goal as { protein_g: number } | null)?.protein_g ?? 0
  const targetCarbs = (goal as { carbs_g: number } | null)?.carbs_g ?? 0
  const calGap = targetCal > 0 ? `${avgCal > targetCal ? 'over' : 'under'} by ${Math.abs(avgCal - targetCal)}` : 'no target set'
  const gpsCount = gps.length
  const avgDist = gpsCount > 0 ? (avg(gps.map((s: { total_distance_m: number }) => s.total_distance_m ?? 0)) / 1000).toFixed(2) : '0'
  const avgSpeed = gpsCount > 0 ? avg(gps.map((s: { max_speed_kmh: number }) => s.max_speed_kmh ?? 0)).toFixed(1) : '0'
  const avgSprints = gpsCount > 0 ? Math.round(avg(gps.map((s: { sprint_count: number }) => s.sprint_count ?? 0))) : 0
  const ratings = matches.filter((m: { coach_rating: number | null }) => m.coach_rating !== null).map((m: { coach_rating: number | null }) => m.coach_rating).join(', ') || 'None'

  const prompt = `Analyse this academy player and generate a development report.

PLAYER PROFILE:
- Position: ${position}
- Age: ${calculateAge((profile as Record<string, unknown>).date_of_birth as string | null)}
- Height: ${(profile as Record<string, unknown>).height_cm ? `${(profile as Record<string, unknown>).height_cm}cm` : 'Unknown'} | Weight: ${(profile as Record<string, unknown>).weight_kg ? `${(profile as Record<string, unknown>).weight_kg}kg` : 'Unknown'} | BMI: ${calculateBmi((profile as Record<string, unknown>).height_cm as number | null, (profile as Record<string, unknown>).weight_kg as number | null)}
- Build: ${(profile as Record<string, unknown>).build ?? 'Unknown'} | Dominant foot: ${(profile as Record<string, unknown>).dominant_foot ?? 'Unknown'}

TRAINING — last 30 days:
- Sessions: ${training.length} | Total: ${totalMins}mins | Avg: ${avgMins}mins
- Breakdown: ${buildSessionBreakdown(training as { session_type: string }[])}

NUTRITION — last 14 days:
- Days tracked: ${daysNutrition}/14 | Avg: ${avgCal}kcal | ${avgProtein}g protein | ${avgCarbs}g carbs
- Targets: ${targetCal}kcal | ${targetProtein}g protein | ${targetCarbs}g carbs | Gap: ${calGap}

GPS — last ${gpsCount} sessions:
- Avg distance: ${avgDist}km | Avg max speed: ${avgSpeed}km/h | Avg sprints: ${avgSprints}

MATCH DATA:
- Appearances: ${matches.length} | Coach ratings: ${ratings}

Return ONLY valid JSON (no markdown):
{
  "headline": "one sentence summary",
  "overall_rating": "developing|on_track|performing|elite",
  "strengths": [{"label": "name", "detail": "why"}],
  "development_areas": [{"area": "name", "priority": "high|medium|low", "position_relevance": "why it matters for ${position}", "this_week_action": "one concrete action"}],
  "training_plan": {"sessions_per_week_target": 4, "recommended_mix": "mix", "key_drill": "drill", "key_focus": "focus"},
  "nutrition_plan": {"daily_calories_target": 2800, "protein_g_target": 140, "carbs_g_target": 350, "key_improvement": "improvement", "match_day_protocol": "protocol", "recovery_meal": "meal"},
  "gps_targets": {"distance_km_per_session": 8.0, "max_speed_kmh_target": 28.0, "sprint_count_target": 20, "current_assessment": "assessment"},
  "position_insight": "2-3 sentences on position demands vs player tracking",
  "this_week_priority": "single most impactful concrete action this week"
}`

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2000,
    system: `You are an elite football development analyst for Tranmere Rovers Academy. Analyse players and produce highly personalised development plans. Be specific and honest. Respond ONLY with valid JSON.`,
    messages: [{ role: 'user', content: prompt }],
  })

  return JSON.parse(extractText(response)) as GeneratedReport
}

// ─── cron handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Secure with CRON_SECRET (Vercel sets the Authorization header automatically)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const staleThreshold = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

  // 1. Get all students
  const { data: students } = await admin
    .from('users')
    .select('id, name')
    .eq('role', 'student')

  if (!students?.length) return NextResponse.json({ processed: 0, refreshed: 0, skipped: 0 })

  // 2. Get all existing reports so we can skip fresh ones
  const { data: existingReports } = await admin
    .from('ai_player_reports')
    .select('student_id, generated_at')
    .in('student_id', students.map(s => s.id))

  const reportMap = new Map(
    (existingReports ?? []).map(r => [r.student_id, r.generated_at])
  )

  const results = { processed: 0, refreshed: 0, skipped: 0, errors: 0 }

  for (const student of students) {
    results.processed++

    // Skip if report is fresh (< 23h old)
    const lastGenerated = reportMap.get(student.id)
    if (lastGenerated && lastGenerated > staleThreshold) {
      results.skipped++
      continue
    }

    try {
      const report = await generateReportForStudent(student.id)

      // No data logged — skip without error
      if (!report) {
        results.skipped++
        continue
      }

      const generatedAt = new Date().toISOString()
      await admin
        .from('ai_player_reports')
        .upsert({ student_id: student.id, generated_at: generatedAt, report_json: report }, { onConflict: 'student_id' })

      results.refreshed++

      // 3. Agentic step: if high-priority development area found → push notification to player
      const highPriority = report.development_areas?.find(d => d.priority === 'high')
      if (highPriority) {
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', student.id)

        if (subs?.length) {
          const firstName = student.name?.split(' ')[0] ?? 'Player'
          const payload = {
            title: `${firstName}, your weekly focus is ready`,
            body: `Priority: ${highPriority.area} — ${highPriority.this_week_action}`,
            url: '/ai-report',
          }
          await Promise.allSettled(
            subs.map(sub =>
              sendPushNotification(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                payload,
              )
            )
          )
        }
      }

      // Small delay between students to avoid AI rate-limit spikes
      await new Promise(r => setTimeout(r, 500))

    } catch {
      results.errors++
    }
  }

  return NextResponse.json(results)
}
