import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getRedFlags, SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminWellbeingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  // Latest completed survey per student with their responses
  const { data: surveys } = await admin
    .from('wellbeing_surveys')
    .select(`
      id, sent_at, completed_at, status,
      users!student_id(name),
      wellbeing_responses(question_key, score, note)
    `)
    .order('sent_at', { ascending: false })
    .limit(100)

  type Survey = {
    id: string
    sent_at: string
    completed_at: string | null
    status: string
    users: { name: string } | null
    wellbeing_responses: { question_key: string; score: number; note: string | null }[]
  }

  const rows = (surveys ?? []) as unknown as Survey[]

  // Deduplicate: latest survey per student
  const seen = new Set<string>()
  const latest = rows.filter(r => {
    const name = r.users?.name ?? r.id
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })

  return (
    <div className="space-y-5 p-4">
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Wellbeing Monitor</h1>
        <p className="text-sm text-muted-foreground">Latest survey results — red flags highlighted</p>
      </div>

      {latest.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No surveys sent yet.</p>
      ) : (
        <div className="space-y-3">
          {latest.map(survey => {
            const flags = getRedFlags(survey.wellbeing_responses)
            const hasFlagred = flags.length > 0
            const avgScore = survey.wellbeing_responses.length > 0
              ? Math.round(survey.wellbeing_responses.reduce((s, r) => s + r.score, 0) / survey.wellbeing_responses.length * 10) / 10
              : null

            return (
              <div
                key={survey.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  hasFlagred ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {hasFlagred && <AlertTriangle size={14} className="text-red-600 shrink-0" />}
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
                  {avgScore !== null && (
                    <span className={`text-lg font-bold ${
                      avgScore >= 4 ? 'text-emerald-600' : avgScore >= 3 ? 'text-amber-500' : 'text-red-600'
                    }`}>
                      {avgScore}
                    </span>
                  )}
                </div>

                {/* Red flags */}
                {hasFlagred && (
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
                  <div className="grid grid-cols-5 gap-1.5">
                    {SURVEY_QUESTIONS.map(q => {
                      const r = survey.wellbeing_responses.find(x => x.question_key === q.key)
                      const isFlag = flags.some(f => f.question_key === q.key)
                      return (
                        <div key={q.key} className={`rounded-lg text-center py-1.5 text-xs ${
                          isFlag ? 'bg-red-200 text-red-800' :
                          !r ? 'bg-gray-100 text-gray-400' :
                          r.score >= 4 ? 'bg-emerald-100 text-emerald-700' :
                          r.score >= 3 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          <p className="text-base leading-none">{q.emoji}</p>
                          <p className="font-bold mt-0.5">{r?.score ?? '—'}</p>
                        </div>
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
