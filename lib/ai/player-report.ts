/**
 * Shared player-report logic used by:
 *   - app/api/ai/player-report/route.ts  (on-demand, per-user)
 *   - app/api/cron/refresh-reports/route.ts (nightly batch)
 *
 * Single source of truth for data fetching, prompt construction, and
 * AI generation. Both callers own their own persistence/cache/auth logic.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'

// ─── types ────────────────────────────────────────────────────────────────────

export interface TrainingLog {
  session_type: string
  session_date: string
  duration_mins: number
}

export interface NutritionLog {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_date: string
}

export interface NutritionGoal {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface GpsSession {
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

export interface MatchSquadEntry {
  coach_rating: number | null
  status: string
}

export interface PlayerProfile {
  name?: string
  position?: string
  height_cm?: number | null
  weight_kg?: number | null
  build?: string
  dominant_foot?: string
  date_of_birth?: string | null
}

export interface PlayerData {
  profile: PlayerProfile
  trainingLogs: TrainingLog[]
  nutritionLogs: NutritionLog[]
  nutritionGoal: NutritionGoal | null
  gpsSessions: GpsSession[]
  matchSquads: MatchSquadEntry[]
}

export interface PlayerReportDevelopmentArea {
  area: string
  priority: 'high' | 'medium' | 'low'
  position_relevance: string
  this_week_action: string
}

export interface PlayerReport {
  headline: string
  overall_rating: 'developing' | 'on_track' | 'performing' | 'elite'
  strengths: { label: string; detail: string }[]
  development_areas: PlayerReportDevelopmentArea[]
  training_plan: {
    sessions_per_week_target: number
    recommended_mix: string
    key_drill: string
    key_focus: string
  }
  nutrition_plan: {
    daily_calories_target: number
    protein_g_target: number
    carbs_g_target: number
    key_improvement: string
    match_day_protocol: string
    recovery_meal: string
  }
  gps_targets: {
    distance_km_per_session: number
    max_speed_kmh_target: number
    sprint_count_target: number
    current_assessment: string
  }
  position_insight: string
  this_week_priority: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function calculateAge(dob: string | null | undefined): string {
  if (!dob) return 'Unknown'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  return String(age)
}

function calculateBmi(heightCm: number | null | undefined, weightKg: number | null | undefined): string {
  if (!heightCm || !weightKg) return 'Unknown'
  return (weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)
}

function buildSessionBreakdown(logs: TrainingLog[]): string {
  const counts: Record<string, number> = {}
  for (const log of logs) {
    const t = log.session_type ?? 'unknown'
    counts[t] = (counts[t] ?? 0) + 1
  }
  return Object.entries(counts).map(([type, count]) => `${count}x ${type}`).join(', ') || 'None'
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all player data needed to generate a report.
 * Uses a 30-day window for training, 14-day for nutrition, last-10 for GPS.
 */
export async function fetchPlayerData(studentId: string): Promise<PlayerData> {
  const admin = createAdminClient()
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
      .eq('id', studentId)
      .maybeSingle(),
    admin
      .from('training_logs')
      .select('session_type, session_date, duration_mins')
      .eq('student_id', studentId)
      .gte('session_date', thirtyDaysAgo),
    admin
      .from('nutrition_logs')
      .select('calories, protein_g, carbs_g, fat_g, logged_date')
      .eq('student_id', studentId)
      .gte('logged_date', fourteenDaysAgo),
    admin
      .from('nutrition_goals')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('student_id', studentId)
      .maybeSingle(),
    admin
      .from('gps_sessions')
      .select('session_date, total_distance_m, hsr_distance_m, sprint_distance_m, max_speed_kmh, sprint_count, accel_count, decel_count, player_load, duration_mins')
      .eq('player_id', studentId)
      .order('session_date', { ascending: false })
      .limit(10),
    admin
      .from('match_squads')
      .select('coach_rating, status')
      .eq('player_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    profile: (profileResult.data ?? {}) as PlayerProfile,
    trainingLogs: (trainingResult.data ?? []) as TrainingLog[],
    nutritionLogs: (nutritionResult.data ?? []) as NutritionLog[],
    nutritionGoal: (nutritionGoalResult.data ?? null) as NutritionGoal | null,
    gpsSessions: (gpsResult.data ?? []) as GpsSession[],
    matchSquads: (matchResult.data ?? []) as MatchSquadEntry[],
  }
}

/**
 * Returns true if the player has enough recent data to warrant a report.
 * Callers can skip the AI call entirely if this returns false.
 */
export function hasReportableData(data: PlayerData): boolean {
  return data.trainingLogs.length > 0 || data.nutritionLogs.length > 0 || data.gpsSessions.length > 0
}

/**
 * Build the AI prompt from a PlayerData payload.
 * Single canonical prompt — both on-demand and cron use this.
 */
export function buildPlayerPrompt(data: PlayerData): string {
  const { profile, trainingLogs, nutritionLogs, nutritionGoal, gpsSessions, matchSquads } = data

  const position = profile.position ?? 'Not set'
  const age = calculateAge(profile.date_of_birth)
  const height = profile.height_cm ? `${profile.height_cm}cm` : 'Unknown'
  const weight = profile.weight_kg ? `${profile.weight_kg}kg` : 'Unknown'
  const bmi = calculateBmi(profile.height_cm, profile.weight_kg)
  const build = profile.build ?? 'Unknown'
  const foot = profile.dominant_foot ?? 'Unknown'

  // Training
  const totalTrainingMins = trainingLogs.reduce((s, l) => s + (l.duration_mins ?? 0), 0)
  const avgSessionMins = trainingLogs.length > 0 ? Math.round(totalTrainingMins / trainingLogs.length) : 0
  const sessionBreakdown = buildSessionBreakdown(trainingLogs)

  // Nutrition
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

  // GPS
  const gpsCount = gpsSessions.length
  const avgDistKm = gpsCount > 0
    ? (avg(gpsSessions.map(s => s.total_distance_m ?? 0)) / 1000).toFixed(2)
    : '0'
  const avgMaxSpeed = gpsCount > 0
    ? avg(gpsSessions.map(s => s.max_speed_kmh ?? 0)).toFixed(1)
    : '0'
  const avgSprints = gpsCount > 0 ? Math.round(avg(gpsSessions.map(s => s.sprint_count ?? 0))) : 0
  const avgHsr = gpsCount > 0 ? Math.round(avg(gpsSessions.map(s => s.hsr_distance_m ?? 0))) : 0
  const avgLoad = gpsCount > 0 ? avg(gpsSessions.map(s => s.player_load ?? 0)).toFixed(1) : '0'

  // Match
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
- Sessions logged: ${trainingLogs.length}
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
- Recent appearances: ${matchSquads.length}
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

/**
 * Call the AI with the canonical prompt and return the parsed report.
 * Throws if the model returns invalid JSON.
 */
export async function callReportAI(prompt: string): Promise<PlayerReport> {
  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2000,
    system: `You are an elite football development analyst for Tranmere Rovers Academy. You analyse young academy players' physical data, training patterns, nutrition, and GPS performance to create highly personalised development plans. Be specific, encouraging but honest, and always relate advice to the player's exact position requirements. Respond ONLY with valid JSON — no markdown, no explanation.`,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractText(response)
  try {
    return JSON.parse(text) as PlayerReport
  } catch {
    throw new Error('AI returned invalid JSON — please try again')
  }
}

/**
 * Convenience: fetch data → check for reportable content → call AI.
 * Returns null if the player has no recent data (skip without error).
 * Does NOT persist — callers own persistence so they can set their own timestamps.
 */
export async function generateReport(studentId: string): Promise<PlayerReport | null> {
  const data = await fetchPlayerData(studentId)
  if (!hasReportableData(data)) return null
  const prompt = buildPlayerPrompt(data)
  return callReportAI(prompt)
}

/**
 * Persist a generated report to ai_player_reports (upsert on student_id).
 * Returns the ISO timestamp written to the row.
 */
export async function persistReport(studentId: string, report: PlayerReport): Promise<string> {
  const admin = createAdminClient()
  const generatedAt = new Date().toISOString()
  await admin
    .from('ai_player_reports')
    .upsert(
      { student_id: studentId, generated_at: generatedAt, report_json: report },
      { onConflict: 'student_id' },
    )
  return generatedAt
}

/**
 * Full pipeline: generate + persist in one call.
 * Returns null if the player has no recent data.
 */
export async function generateAndPersistReport(
  studentId: string,
): Promise<{ report: PlayerReport; generatedAt: string } | null> {
  const report = await generateReport(studentId)
  if (!report) return null
  const generatedAt = await persistReport(studentId, report)
  return { report, generatedAt }
}
