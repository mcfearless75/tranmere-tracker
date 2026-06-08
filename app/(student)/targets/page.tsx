import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { extractTargets, hasAnyTargets } from '@/lib/targets/targetsUtils'
import { Target, CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TargetsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: reviews } = await supabase
    .from('learner_reviews')
    .select('id, term, completed_at, status')
    .eq('student_id', user.id)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })

  const reviewList = reviews ?? []

  // Fetch answers for all completed reviews in one query
  const reviewIds = reviewList.map(r => r.id)

  const { data: allAnswers } = reviewIds.length > 0
    ? await supabase
        .from('review_answers')
        .select('review_id, question_key, answer')
        .in('review_id', reviewIds)
        .in('question_key', ['agreed_targets', 'support_needs', 'academic_improvements', 'football_improvements'])
    : { data: [] }

  const answersByReview = new Map<string, { question_key: string; answer: string }[]>()
  for (const a of allAnswers ?? []) {
    const bucket = answersByReview.get(a.review_id) ?? []
    bucket.push({ question_key: a.question_key, answer: a.answer })
    answersByReview.set(a.review_id, bucket)
  }

  const targetGroups = reviewList.map(r =>
    extractTargets(r, answersByReview.get(r.id) ?? [])
  ).filter(hasAnyTargets)

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue flex items-center gap-2">
          <Target size={20} /> My Targets &amp; Actions
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Agreed targets and actions from your 1-to-1 reviews
        </p>
      </div>

      {targetGroups.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-2">
          <Target size={36} className="text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No reviews completed yet</p>
          <p className="text-sm text-muted-foreground">
            Your targets will appear here after your 1-to-1 meeting.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {targetGroups.map(t => (
            <div key={t.reviewId} className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
              {/* Review header */}
              <div className="flex items-center gap-2 border-b pb-3">
                <CalendarDays size={15} className="text-tranmere-blue shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-tranmere-blue">{t.term}</p>
                  {t.completedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.completedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Target fields */}
              <div className="space-y-3">
                {t.agreedTargets && (
                  <TargetField label="Agreed Targets" value={t.agreedTargets} colour="blue" />
                )}
                {t.supportNeeds && (
                  <TargetField label="Support Needs" value={t.supportNeeds} colour="purple" />
                )}
                {t.academicImprovements && (
                  <TargetField label="Academic Improvements" value={t.academicImprovements} colour="amber" />
                )}
                {t.footballImprovements && (
                  <TargetField label="Football Improvements" value={t.footballImprovements} colour="green" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TargetField({
  label,
  value,
  colour,
}: {
  label: string
  value: string
  colour: 'blue' | 'purple' | 'amber' | 'green'
}) {
  const styles = {
    blue:   'bg-blue-50 text-blue-800 border-blue-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    amber:  'bg-amber-50 text-amber-800 border-amber-200',
    green:  'bg-green-50 text-green-800 border-green-200',
  }[colour]

  const labelStyles = {
    blue:   'text-blue-600',
    purple: 'text-purple-600',
    amber:  'text-amber-600',
    green:  'text-green-600',
  }[colour]

  return (
    <div className={`rounded-xl border p-3 ${styles}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${labelStyles}`}>{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}
