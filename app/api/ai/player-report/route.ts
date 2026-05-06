import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'

export const dynamic = 'force-dynamic'

interface TrainingLog {
  session_type: string
  session_date: string
  duration_mins: number
}

interface NutritionLog {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_date: string
}

interface NutritionGoal {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface GpsSession {
  session_date: string
  total_distance_m: number
  hsr_distance_m: number
  sprint_distance_m: number
  max_speed_kmh: number
  sprint_count: number
  accel_count: number
  decel_count: number
  player_load: number
  duration_mins: number
}

interface MatchSquadEntry {
  coach_rating: number | null
  status: string
}

function calculateAge(dob: string | null): string {
  if (!dob) return 'Unknown'
  const birth = new Date(dob)
  const now = new Date()
  const age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return String(age)
}

function calculateBmi(heightCm: number | null, weightKg: number | null): string {
  if (!heightCm || !weightKg) return 'Unknown'
  const bmi = weightKg / Math.pow(heightCm / 100, 2)
  return bmi.toFixed(1)
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function buildSessionBreakdown(logs: TrainingLog[]): string {
  const counts: Record<string, number> = {}
  for (const log of logs) {
    const t = log.session_type ?? 'unknown'
    counts[t] = (counts[t] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([type, count]) => `${count}x ${type}`)
    .join(', ') || 'None'
}

function buildPrompt(
  profile: Record<string, unknown>,
  trainingLogs: TrainingLog[],
  nutritionLogs: NutritionLog[],
  nutritionGoal: NutritionGoal | null,
  gpsSessions: GpsSession[],
  matchSquads: MatchSquadEntry[],
): string {
  const position = (profile.position as string) ?? 'Not set'
  const age = calculateAge(profile.date_of_birth as string | null)
  const height = profile.height_cm ? `${profile.height_cm}cm` : 'Unknown'
  const weight = profile.weight_kg ? `${profile.weight_kg}kg` : 'Unknown'
  const bmi = calculateBmi(profile.height_cm as number | null, profile.weight_kg as number | null)
  const build = (profile.build as string) ?? 'Unknown'
  const foot = (profile.dominant_foot as string) ?? 'Unknown'

  const totalTrainingSessions = trainingLogs.length
  const totalTrainingMins = trainingLogs.reduce((s, l) => s + (l.duration_mins ?? 0), 0)
  const avgSessionMins = totalTrainingSessions > 0
    ? Math.round(totalTrainingMins / totalTrainingSessions)
    : 0
  const sessionBreakdown = buildSessionBreakdown(trainingLogs)

  const daysWithNutrition = new Set(nutritionLogs.map(l => l.logged_date)).size
  const nutritionPct = Math.round((daysWithNutrition / 14) * 100)
  const avgCal = Math.round(avg(nutritionLogs.map(l => l.calories ?? 0)))
  const avgProtein = Math.round(avg(nutritionLogs.map(l => l.protein_g ?? 0)))
  const avgCarbs = Math.round(avg(nutritionLogs.map(l => l.carbs_g ?? 0)))
  const avgFat = Math.round(avg(nutritionLogs.map(l => l.fat_g ?? 0)))
  const targetCal = nutritionGoal?.calories ?? 0
  const targetProtein = nutritionGoal?.protein_g ?? 0
  const targetCarbs = nutritionGoal?.carbs_g ?? 0
  const calGap = targetCal > 0
    ? `${avgCal > targetCal ? 'over' : 'under'} by ${Math.abs(avgCal - targetCal)}`
    : 'no target set'

  const gpsCount = gpsSessions.length
  const avgDistKm = gpsCount > 0
    ? (avg(gpsSessions.map(s => s.total_distance_m ?? 0)) / 1000).toFixed(2)
    : '0'
  const avgMaxSpeed = gpsCount > 0
    ? avg(gpsSessions.map(s => s.max_speed_kmh ?? 0)).toFixed(1)
    : '0'
  const avgSprints = gpsCount > 0
    ? Math.round(avg(gpsSessions.map(s => s.sprint_count ?? 0)))
    : 0
  const avgHsr = gpsCount > 0
    ? Math.round(avg(gpsSessions.map(s => s.hsr_distance_m ?? 0)))
    : 0
  const avgLoad = gpsCount > 0
    ? avg(gpsSessions.map(s => s.player_load ?? 0)).toFixed(1)
    : '0'

  const matchCount = matchSquads.length
  const ratings = matchSquads
    .filter(m => m.coach_rating !== null)
    .map(m => m.coach_rating)
    .join(', ') || 'No ratings yet'

  return `Analyse this academy player and generate a development report.

PLAYER PROFILE:
- Position: ${position}
- Age: ${age}
- Height: ${height} | Weight: ${weight} | BMI: ${bmi}
- Build: ${build} | Dominant foot: ${foot}

TRAINING — last 30 days:
- Sessions logged: ${totalTrainingSessions}
- Total time: ${totalTrainingMins} mins
- Session breakdown: ${sessionBreakdown}
- Average session: ${avgSessionMins} mins

NUTRITION — last 14 days:
- Days tracked: ${daysWithNutrition}/14 (${nutritionPct}%)
- Daily average: ${avgCal}kcal | ${avgProtein}g protein | ${avgCarbs}g carbs | ${avgFat}g fat
- Personal targets: ${targetCal}kcal | ${targetProtein}g protein | ${targetCarbs}g carbs
- Calorie gap: ${calGap} kcal vs target

GPS — last ${gpsCount} sessions:
- Avg distance: ${avgDistKm}km per session
- Avg max speed: ${avgMaxSpeed}km/h
- Avg sprints: ${avgSprints} per session
- Avg HSR distance: ${avgHsr}m
- Avg player load: ${avgLoad}

MATCH DATA:
- Recent appearances: ${matchCount}
- Coach ratings (latest first): ${ratings}

Return ONLY this JSON structure:
{
  "headline": "one compelling sentence summarising status and key opportunity",
  "overall_rating": "developing|on_track|performing|elite",
  "strengths": [
    {"label": "strength name", "detail": "why this is a genuine strength based on the data"}
  ],
  "development_areas": [
    {
      "area": "area name",
      "priority": "high|medium|low",
      "position_relevance": "why this specifically matters for ${position}",
      "this_week_action": "one concrete achievable action for this week"
    }
  ],
  "training_plan": {
    "sessions_per_week_target": 4,
    "recommended_mix": "e.g. 2x technical, 1x strength, 1x cardio, 1x recovery",
    "key_drill": "one specific drill relevant to their position and weaknesses",
    "key_focus": "the single most important training improvement"
  },
  "nutrition_plan": {
    "daily_calories_target": 2800,
    "protein_g_target": 140,
    "carbs_g_target": 350,
    "key_improvement": "single most impactful nutritional change",
    "match_day_protocol": "specific match day timing and food guidance",
    "recovery_meal": "post-training meal recommendation for their build and position"
  },
  "gps_targets": {
    "distance_km_per_session": 8.0,
    "max_speed_kmh_target": 28.0,
    "sprint_count_target": 20,
    "current_assessment": "honest assessment of GPS output for their position"
  },
  "position_insight": "2-3 sentences on what this position demands and how this player is tracking against those demands",
  "this_week_priority": "single most impactful specific action this week — concrete and achievable"
}`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const url = new URL(req.url)
    const force = url.searchParams.get('force') === '1'

    const admin = createAdminClient()

    // Check cache unless force refresh
    if (!force) {
      const { data: cached } = await admin
        .from('ai_player_reports')
        .select('report_json, generated_at')
        .eq('student_id', user.id)
        .single()

      if (cached) {
        const age = Date.now() - new Date(cached.generated_at).getTime()
        if (age < 24 * 60 * 60 * 1000) {
          return NextResponse.json({ report: cached.report_json, generated_at: cached.generated_at, cached: true })
        }
      }
    }

    // Gather all player data in parallel
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      profileResult,
      trainingResult,
      nutritionResult,
      nutritionGoalResult,
      gpsResult,
      matchResult,
    ] = await Promise.all([
      admin
        .from('users')
        .select('name, position, height_cm, weight_kg, build, dominant_foot, date_of_birth')
        .eq('id', user.id)
        .single(),
      admin
        .from('training_logs')
        .select('session_type, session_date, duration_mins')
        .eq('student_id', user.id)
        .gte('session_date', thirtyDaysAgo),
      admin
        .from('nutrition_logs')
        .select('calories, protein_g, carbs_g, fat_g, logged_date')
        .eq('student_id', user.id)
        .gte('logged_date', fourteenDaysAgo),
      admin
        .from('nutrition_goals')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('student_id', user.id)
        .maybeSingle(),
      admin
        .from('gps_sessions')
        .select('session_date, total_distance_m, hsr_distance_m, sprint_distance_m, max_speed_kmh, sprint_count, accel_count, decel_count, player_load, duration_mins')
        .eq('player_id', user.id)
        .order('session_date', { ascending: false })
        .limit(10),
      admin
        .from('match_squads')
        .select('coach_rating, status')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const profile = profileResult.data ?? {}
    const trainingLogs: TrainingLog[] = trainingResult.data ?? []
    const nutritionLogs: NutritionLog[] = nutritionResult.data ?? []
    const nutritionGoal: NutritionGoal | null = nutritionGoalResult.data ?? null
    const gpsSessions: GpsSession[] = gpsResult.data ?? []
    const matchSquads: MatchSquadEntry[] = matchResult.data ?? []

    const userPrompt = buildPrompt(profile, trainingLogs, nutritionLogs, nutritionGoal, gpsSessions, matchSquads)

    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2000,
      system: `You are an elite football development analyst for Tranmere Rovers Academy. You analyse young academy players' physical data, training patterns, nutrition, and GPS performance to create highly personalised development plans. Be specific, encouraging but honest, and always relate advice to the player's exact position requirements. Respond ONLY with valid JSON — no markdown, no explanation.`,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = extractText(response)

    let report: unknown
    try {
      report = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON — please try again' }, { status: 500 })
    }

    const generatedAt = new Date().toISOString()

    await admin
      .from('ai_player_reports')
      .upsert(
        { student_id: user.id, generated_at: generatedAt, report_json: report },
        { onConflict: 'student_id' },
      )

    return NextResponse.json({ report, generated_at: generatedAt, cached: false })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
