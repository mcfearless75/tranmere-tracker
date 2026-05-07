import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropic, MODELS, extractText } from '@/lib/ai'
import Link from 'next/link'
import { Brain, RefreshCw, Star, TrendingUp, Target, Zap, Apple, Activity, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ---------- types ----------

interface Strength {
  label: string
  detail: string
}

interface DevelopmentArea {
  area: string
  priority: 'high' | 'medium' | 'low'
  position_relevance: string
  this_week_action: string
}

interface TrainingPlan {
  sessions_per_week_target: number
  recommended_mix: string
  key_drill: string
  key_focus: string
}

interface NutritionPlan {
  daily_calories_target: number
  protein_g_target: number
  carbs_g_target: number
  key_improvement: string
  match_day_protocol: string
  recovery_meal: string
}

interface GpsTargets {
  distance_km_per_session: number
  max_speed_kmh_target: number
  sprint_count_target: number
  current_assessment: string
}

interface PlayerReport {
  headline: string
  overall_rating: 'developing' | 'on_track' | 'performing' | 'elite'
  strengths: Strength[]
  development_areas: DevelopmentArea[]
  training_plan: TrainingPlan
  nutrition_plan: NutritionPlan
  gps_targets: GpsTargets
  position_insight: string
  this_week_priority: string
}

// ---------- helpers ----------

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
  return Object.entries(counts)
    .map(([type, count]) => `${count}x ${type}`)
    .join(', ') || 'None'
}

function calculateAge(dob: string | null): string {
  if (!dob) return 'Unknown'
  const birth = new Date(dob)
  const now = new Date()
  return String(Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
}

function calculateBmi(h: number | null, w: number | null): string {
  if (!h || !w) return 'Unknown'
  return (w / Math.pow(h / 100, 2)).toFixed(1)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

const ratingConfig = {
  developing: { label: 'Developing', bg: 'bg-gray-100', text: 'text-gray-700' },
  on_track: { label: 'On Track', bg: 'bg-blue-100', text: 'text-blue-700' },
  performing: { label: 'Performing', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  elite: { label: 'Elite', bg: 'bg-yellow-100', text: 'text-yellow-700' },
} as const

const priorityConfig = {
  high: { label: 'HIGH', bg: 'bg-red-100', text: 'text-red-700' },
  medium: { label: 'MEDIUM', bg: 'bg-amber-100', text: 'text-amber-700' },
  low: { label: 'LOW', bg: 'bg-blue-100', text: 'text-blue-700' },
} as const

// ---------- data + AI generation ----------

async function generateReport(userId: string): Promise<{ report: PlayerReport; generated_at: string }> {
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
    admin.from('users').select('name, position, height_cm, weight_kg, build, dominant_foot, date_of_birth').eq('id', userId).single(),
    admin.from('training_logs').select('session_type, session_date, duration_mins').eq('student_id', userId).gte('session_date', thirtyDaysAgo),
    admin.from('nutrition_logs').select('calories, protein_g, carbs_g, fat_g, logged_date').eq('student_id', userId).gte('logged_date', fourteenDaysAgo),
    admin.from('nutrition_goals').select('calories, protein_g, carbs_g, fat_g').eq('student_id', userId).maybeSingle(),
    admin.from('gps_sessions').select('session_date, total_distance_m, hsr_distance_m, sprint_distance_m, max_speed_kmh, sprint_count, accel_count, decel_count, player_load, duration_mins').eq('player_id', userId).order('session_date', { ascending: false }).limit(10),
    admin.from('match_squads').select('coach_rating, status').eq('player_id', userId).order('created_at', { ascending: false }).limit(5),
  ])

  interface ProfileData {
    name: string | null
    position: string | null
    height_cm: number | null
    weight_kg: number | null
    build: string | null
    dominant_foot: string | null
    date_of_birth: string | null
  }
  const profile: ProfileData = (profileResult.data ?? {}) as ProfileData
  const trainingLogs = trainingResult.data ?? []
  const nutritionLogs = nutritionResult.data ?? []
  const nutritionGoal = nutritionGoalResult.data ?? null
  const gpsSessions = gpsResult.data ?? []
  const matchSquads = matchResult.data ?? []

  const position = profile.position ?? 'Not set'
  const totalTrainingMins = trainingLogs.reduce((s: number, l: { duration_mins: number }) => s + (l.duration_mins ?? 0), 0)
  const avgSessionMins = trainingLogs.length > 0 ? Math.round(totalTrainingMins / trainingLogs.length) : 0
  const daysWithNutrition = new Set(nutritionLogs.map((l: { logged_date: string }) => l.logged_date)).size
  const avgCal = Math.round(avg(nutritionLogs.map((l: { calories: number }) => l.calories ?? 0)))
  const avgProtein = Math.round(avg(nutritionLogs.map((l: { protein_g: number }) => l.protein_g ?? 0)))
  const avgCarbs = Math.round(avg(nutritionLogs.map((l: { carbs_g: number }) => l.carbs_g ?? 0)))
  const avgFat = Math.round(avg(nutritionLogs.map((l: { fat_g: number }) => l.fat_g ?? 0)))
  const targetCal = (nutritionGoal as { calories: number } | null)?.calories ?? 0
  const targetProtein = (nutritionGoal as { protein_g: number } | null)?.protein_g ?? 0
  const targetCarbs = (nutritionGoal as { carbs_g: number } | null)?.carbs_g ?? 0
  const calGap = targetCal > 0 ? `${avgCal > targetCal ? 'over' : 'under'} by ${Math.abs(avgCal - targetCal)}` : 'no target set'
  const gpsCount = gpsSessions.length
  const avgDistKm = gpsCount > 0 ? (avg(gpsSessions.map((s: { total_distance_m: number }) => s.total_distance_m ?? 0)) / 1000).toFixed(2) : '0'
  const avgMaxSpeed = gpsCount > 0 ? avg(gpsSessions.map((s: { max_speed_kmh: number }) => s.max_speed_kmh ?? 0)).toFixed(1) : '0'
  const avgSprints = gpsCount > 0 ? Math.round(avg(gpsSessions.map((s: { sprint_count: number }) => s.sprint_count ?? 0))) : 0
  const avgHsr = gpsCount > 0 ? Math.round(avg(gpsSessions.map((s: { hsr_distance_m: number }) => s.hsr_distance_m ?? 0))) : 0
  const avgLoad = gpsCount > 0 ? avg(gpsSessions.map((s: { player_load: number }) => s.player_load ?? 0)).toFixed(1) : '0'
  const ratings = matchSquads.filter((m: { coach_rating: number | null }) => m.coach_rating !== null).map((m: { coach_rating: number | null }) => m.coach_rating).join(', ') || 'No ratings yet'

  const userPrompt = `Analyse this academy player and generate a development report.

PLAYER PROFILE:
- Position: ${position}
- Age: ${calculateAge(profile.date_of_birth)}
- Height: ${profile.height_cm ? `${profile.height_cm}cm` : 'Unknown'} | Weight: ${profile.weight_kg ? `${profile.weight_kg}kg` : 'Unknown'} | BMI: ${calculateBmi(profile.height_cm, profile.weight_kg)}
- Build: ${profile.build ?? 'Unknown'} | Dominant foot: ${profile.dominant_foot ?? 'Unknown'}

TRAINING — last 30 days:
- Sessions logged: ${trainingLogs.length}
- Total time: ${totalTrainingMins} mins
- Session breakdown: ${buildSessionBreakdown(trainingLogs)}
- Average session: ${avgSessionMins} mins

NUTRITION — last 14 days:
- Days tracked: ${daysWithNutrition}/14 (${Math.round((daysWithNutrition / 14) * 100)}%)
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

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2000,
    system: `You are an elite football development analyst for Tranmere Rovers Academy. You analyse young academy players' physical data, training patterns, nutrition, and GPS performance to create highly personalised development plans. Be specific, encouraging but honest, and always relate advice to the player's exact position requirements. Respond ONLY with valid JSON — no markdown, no explanation.`,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = extractText(response)
  const report = JSON.parse(text) as PlayerReport
  const generated_at = new Date().toISOString()

  await admin
    .from('ai_player_reports')
    .upsert({ student_id: userId, generated_at, report_json: report }, { onConflict: 'student_id' })

  return { report, generated_at }
}

// ---------- page component ----------

export default async function AiReportPage({
  searchParams,
}: {
  searchParams: { refresh?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const admin = createAdminClient()
  const refresh = searchParams.refresh === '1'

  let report: PlayerReport | null = null
  let generatedAt: string | null = null
  let error: string | null = null
  let fromCache = false

  // Try cache first unless refresh requested
  if (!refresh) {
    const { data: cached } = await admin
      .from('ai_player_reports')
      .select('report_json, generated_at')
      .eq('student_id', user.id)
      .single()

    if (cached) {
      const age = Date.now() - new Date(cached.generated_at).getTime()
      if (age < 24 * 60 * 60 * 1000) {
        report = cached.report_json as PlayerReport
        generatedAt = cached.generated_at
        fromCache = true
      }
    }
  }

  // Generate if needed
  if (!report) {
    try {
      const result = await generateReport(user.id)
      report = result.report
      generatedAt = result.generated_at
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Failed to generate report'
    }
  }

  // Check if position is set (for advisory banner)
  const { data: profileData } = await admin
    .from('users')
    .select('position')
    .eq('id', user.id)
    .single()
  const noPosition = !profileData?.position

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={22} className="text-tranmere-blue" />
          <h1 className="text-xl font-bold text-tranmere-blue">AI Development Report</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {generatedAt && <span>Generated {timeAgo(generatedAt)}{fromCache ? ' · cached' : ''}</span>}
          <Link
            href="/ai-report?refresh=1"
            className="flex items-center gap-1 text-tranmere-blue font-medium hover:underline"
          >
            <RefreshCw size={13} />
            Refresh
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center space-y-3">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <p className="text-red-700 font-medium">Could not generate your report</p>
          <p className="text-red-600 text-sm">{error}</p>
          <Link
            href="/ai-report?refresh=1"
            className="inline-block bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Try again
          </Link>
        </div>
      )}

      {/* No position advisory */}
      {noPosition && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Set your position in{' '}
            <Link href="/profile" className="underline font-medium">Profile</Link>
            {' '}to get more specific position-based advice.
          </span>
        </div>
      )}

      {report && (
        <>
          {/* Hero */}
          <div className="bg-gradient-to-br from-tranmere-blue to-blue-900 text-white rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold leading-snug flex-1">{report.headline}</p>
              {report.overall_rating && (() => {
                const cfg = ratingConfig[report.overall_rating] ?? ratingConfig.developing
                return (
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                )
              })()}
            </div>
            <p className="text-white/70 text-xs italic">{report.position_insight}</p>
          </div>

          {/* This Week Priority */}
          <div className="bg-tranmere-gold/10 border-2 border-tranmere-gold rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-tranmere-gold" />
              <span className="text-xs font-bold text-tranmere-gold tracking-wide uppercase">This Week&apos;s Priority</span>
            </div>
            <p className="text-gray-800 font-semibold text-sm">{report.this_week_priority}</p>
          </div>

          {/* Strengths + Development Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Star size={15} className="text-emerald-500" />
                Strengths
              </h2>
              {report.strengths?.map((s, i) => (
                <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-0.5">
                  <p className="text-sm font-semibold text-emerald-800">{s.label}</p>
                  <p className="text-xs text-emerald-700">{s.detail}</p>
                </div>
              ))}
            </div>

            {/* Development Areas */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-blue-500" />
                Development Areas
              </h2>
              {report.development_areas?.map((d, i) => {
                const pcfg = priorityConfig[d.priority] ?? priorityConfig.low
                return (
                  <div key={i} className="bg-white border rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">{d.area}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pcfg.bg} ${pcfg.text}`}>
                        {pcfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 italic">{d.position_relevance}</p>
                    <p className="text-xs text-gray-700 font-medium">{d.this_week_action}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Training Plan */}
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <Zap size={15} className="text-purple-500" />
              Training Plan
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-purple-50 rounded-lg p-2.5">
                <p className="text-purple-500 font-medium mb-0.5">Sessions / week</p>
                <p className="text-gray-800 font-bold text-base">{report.training_plan?.sessions_per_week_target}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2.5">
                <p className="text-purple-500 font-medium mb-0.5">Recommended mix</p>
                <p className="text-gray-700">{report.training_plan?.recommended_mix}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 space-y-1 text-xs">
              <p><span className="font-semibold text-gray-600">Key drill:</span> {report.training_plan?.key_drill}</p>
              <p><span className="font-semibold text-gray-600">Key focus:</span> {report.training_plan?.key_focus}</p>
            </div>
          </div>

          {/* Nutrition Plan */}
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <Apple size={15} className="text-green-500" />
              Nutrition Plan
            </h2>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-green-600 font-medium">Calories</p>
                <p className="text-gray-800 font-bold">{report.nutrition_plan?.daily_calories_target}kcal</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-green-600 font-medium">Protein</p>
                <p className="text-gray-800 font-bold">{report.nutrition_plan?.protein_g_target}g</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-green-600 font-medium">Carbs</p>
                <p className="text-gray-800 font-bold">{report.nutrition_plan?.carbs_g_target}g</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 space-y-1 text-xs">
              <p><span className="font-semibold text-gray-600">Key improvement:</span> {report.nutrition_plan?.key_improvement}</p>
              <p><span className="font-semibold text-gray-600">Match day:</span> {report.nutrition_plan?.match_day_protocol}</p>
              <p><span className="font-semibold text-gray-600">Recovery meal:</span> {report.nutrition_plan?.recovery_meal}</p>
            </div>
          </div>

          {/* GPS Targets */}
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <Activity size={15} className="text-blue-500" />
              GPS Targets
            </h2>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-blue-600 font-medium">Distance</p>
                <p className="text-gray-800 font-bold">{report.gps_targets?.distance_km_per_session}km</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-blue-600 font-medium">Max speed</p>
                <p className="text-gray-800 font-bold">{report.gps_targets?.max_speed_kmh_target}km/h</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                <p className="text-blue-600 font-medium">Sprints</p>
                <p className="text-gray-800 font-bold">{report.gps_targets?.sprint_count_target}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-xs">
              <p className="text-gray-700">{report.gps_targets?.current_assessment}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
