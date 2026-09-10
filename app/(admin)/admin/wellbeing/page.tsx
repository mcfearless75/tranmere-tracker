import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRedFlags, buildWellbeingTrend, normalizedScore, CONTEXT_TAGS, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
import { WellbeingSparkline } from '@/components/wellbeing/WellbeingSparkline'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminWellbeingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  // Open to admin/coach/teacher alike (the (admin) layout already restricts
  // this route to those three roles) — reversed 2026-09-10, product-owner
  // decision, from an earlier admin-only lock. That lock existed because
  // research ties coach-visible scores to students under-reporting; opening
  // it back up re-accepts that trade-off deliberately. No replacement
  // signal (e.g. a coach-facing summary instead of raw scores) was built
  // either time — still an open, separate decision if this needs revisiting.

  // Fetch recent surveys — enough to build a 3-survey trend per student
  const { data: surveys } = await admin
    .from('wellbeing_surveys')
    .select(`
      id, sent_at, completed_at, status, context_tags,
      users!student_id(name),
      wellbeing_responses(question_key, score, note)
    `)
    .order('sent_at', { ascending: false })
    .limit(200)

  type Survey = {
    id: string
    sent_at: string
    completed_at: string | null
    status: string
    context_tags: string[] | null
    users: { name: string } | null
    wellbeing_responses: { question_key: string; score: number; note: string | null }[]
  }

  const rows = (surveys ?? []) as unknown as Survey[]

  // Group by student — keep up to 3 surveys per student (already sorted newest first)
  const byStudent = new Map<string, Survey[]>()
  for (const r of rows) {
    const key = r.users?.name ?? r.id
    if (!byStudent.has(key)) byStudent.set(key, [])
    const group = byStudent.get(key)!
    if (group.length < 3) group.push(r)
  }

  const studentGroups = Array.from(byStudent.values())

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Wellbeing Monitor</h1>
        <p className="text-sm text-muted-foreground">Latest survey results — red flags highlighted</p>
      </div>

      {studentGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No surveys sent yet.</p>
      ) : (
        <div className="space-y-3">
          {studentGroups.map(group => {
            const survey = group[0] // latest
            const flags = getRedFlags(survey.wellbeing_responses)
            const hasFlagged = flags.length > 0
            const avgScore = survey.wellbeing_responses.length > 0
              ? Math.round(survey.wellbeing_responses.reduce((s, r) => s + normalizedScore(r.question_key, r.score), 0) / survey.wellbeing_responses.length * 10) / 10
              : null

            // Build trend from the group (oldest → newest for left-to-right progression)
            const trendData = buildWellbeingTrend([...group].reverse())

            return (
              <div
                key={survey.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  hasFlagged ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {hasFlagged && <AlertTriangle size={14} className="text-red-600 shrink-0" />}
                      <p className="font-semibold text-sm text-gray-900">{survey.users?.name ?? 'Unknown'}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(survey.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      <span className={`font-medium capitalize ${
                        survey.status === 'completed' ? 'text-emerald-600' :
                        survey.status === 'open' ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {survey.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Sparkline trend — only shown when 2+ surveys exist */}
                    <WellbeingSparkline data={trendData} />
                    {avgScore !== null && (
                      <span className={`text-lg font-bold ${
                        avgScore >= 4 ? 'text-emerald-600' : avgScore >= 3 ? 'text-amber-500' : 'text-red-600'
                      }`}>
                        {avgScore}
                      </span>
                    )}
                  </div>
                </div>

                {/* Red flags */}
                {hasFlagged && (
                  <div className="rounded-xl bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium space-y-0.5">
                    {flags.map(f => {
                      const q = SURVEY_QUESTIONS.find(sq => sq.key === f.question_key)
                      return (
                        <p key={f.question_key}>⚠ {q?.label ?? f.question_key}: scored {f.score}/5</p>
                      )
                    })}
                  </div>
                )}

                {/* Score grid */}
                {survey.wellbeing_responses.length > 0 && (
                  <div className="grid grid-cols-6 gap-1.5">
                    {SURVEY_QUESTIONS.map(q => {
                      const r = survey.wellbeing_responses.find(x => x.question_key === q.key)
                      const isFlag = flags.some(f => f.question_key === q.key)
                      const normalized = r ? normalizedScore(q.key, r.score) : null
                      return (
                        <div key={q.key} className={`rounded-lg text-center py-1.5 text-xs ${
                          isFlag ? 'bg-red-200 text-red-800' :
                          normalized === null ? 'bg-gray-100 text-gray-400' :
                          normalized >= 4 ? 'bg-emerald-100 text-emerald-700' :
                          normalized >= 3 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          <p className="text-base leading-none">{q.emoji}</p>
                          <p className="font-bold mt-0.5">{r?.score ?? '—'}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Context tags — "what's been on your mind" picker, not scored */}
                {survey.context_tags && survey.context_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {survey.context_tags.map(tagKey => {
                      const tag = CONTEXT_TAGS.find(t => t.key === tagKey)
                      return (
                        <span
                          key={tagKey}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-tranmere-blue text-xs font-medium px-2.5 py-1"
                        >
                          {tag?.emoji} {tag?.label ?? tagKey}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Notes — free-text follow-up per question, the highest-signal field in the survey */}
                {survey.wellbeing_responses.some(r => r.note?.trim()) && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 space-y-1">
                    {survey.wellbeing_responses.filter(r => r.note?.trim()).map(r => {
                      const q = SURVEY_QUESTIONS.find(sq => sq.key === r.question_key)
                      return (
                        <p key={r.question_key} className="text-xs text-gray-700">
                          <span className="font-medium">{q?.label ?? r.question_key}:</span> “{r.note}”
                        </p>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
