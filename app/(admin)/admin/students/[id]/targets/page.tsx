import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft, Target, CalendarDays } from 'lucide-react'
import { extractTargets, hasAnyTargets } from '@/lib/targets/targetsUtils'

export const dynamic = 'force-dynamic'

export default async function AdminStudentTargetsPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const studentId = params.id

  const { data: student } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', studentId)
    .maybeSingle()

  if (!student) {
    return (
      <div className="text-center py-16 space-y-2">
        <p className="font-semibold text-gray-700">Student not found.</p>
        <Link href="/admin/users" className="text-tranmere-blue underline text-sm">
          Back to Users
        </Link>
      </div>
    )
  }

  const { data: reviews } = await supabase
    .from('learner_reviews')
    .select('id, term, completed_at, status')
    .eq('student_id', studentId)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })

  const reviewList = reviews ?? []
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
    <div className="space-y-5">
      <Link
        href={`/admin/students/${studentId}`}
        className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline"
      >
        <ArrowLeft size={14} /> Back to {student.name}
      </Link>

      <div className="flex items-center gap-2">
        <Target size={20} className="text-tranmere-blue" />
        <div>
          <h1 className="text-xl font-bold text-tranmere-blue">
            Targets &amp; Actions — {student.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Agreed targets and actions from completed reviews
          </p>
        </div>
      </div>

      {targetGroups.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-2">
          <Target size={36} className="text-gray-300 mx-auto" />
          <p className="font-semibold text-gray-700">No completed reviews yet</p>
          <p className="text-sm text-muted-foreground">
            Targets will appear here once a review is marked complete.
          </p>
          <Link
            href={`/admin/students/${studentId}/review/new?name=${encodeURIComponent(student.name ?? '')}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-tranmere-blue bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg mt-2"
          >
            Start a Review
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {targetGroups.map(t => (
            <div key={t.reviewId} className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
              {/* Review header */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
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
              </div>

              {/* Target fields */}
              <div className="space-y-3">
                {t.agreedTargets && (
                  <AdminTargetField label="Agreed Targets" value={t.agreedTargets} colour="blue" />
                )}
                {t.supportNeeds && (
                  <AdminTargetField label="Support Needs" value={t.supportNeeds} colour="purple" />
                )}
                {t.academicImprovements && (
                  <AdminTargetField label="Academic Improvements" value={t.academicImprovements} colour="amber" />
                )}
                {t.footballImprovements && (
                  <AdminTargetField label="Football Improvements" value={t.footballImprovements} colour="green" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminTargetField({
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
