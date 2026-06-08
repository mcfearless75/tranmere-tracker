import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { REVIEW_QUESTIONS } from '@/lib/learnerReview/reviewUtils'
import { PrintTrigger } from './PrintTrigger'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string; reviewId: string }
}

export default async function ReviewPrintPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  const { data: review } = await admin
    .from('learner_reviews')
    .select('id, term, scheduled_for, status, completed_at, ai_summary, reviewer_id')
    .eq('id', params.reviewId)
    .eq('student_id', params.id)
    .maybeSingle()

  if (!review) notFound()

  const [{ data: student }, { data: answers }] = await Promise.all([
    admin.from('users').select('name, email').eq('id', params.id).single(),
    admin.from('review_answers').select('question_key, answer').eq('review_id', params.reviewId),
  ])

  const answerMap = Object.fromEntries((answers ?? []).map(a => [a.question_key, a.answer]))
  const aiSummary = (review.ai_summary as { text?: string } | null)?.text ?? null

  const reviewDate = review.completed_at ?? review.scheduled_for
  const dateDisplay = reviewDate
    ? new Date(reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date not set'

  return (
    <>
      <PrintTrigger />
      <div className="print-page max-w-2xl mx-auto px-8 py-10 text-gray-900 font-sans">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tranmere Rovers FC</h1>
            <p className="text-sm text-gray-600 mt-0.5">Academy — Learner Review</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-semibold text-gray-900">{review.term}</p>
            <p>{dateDisplay}</p>
          </div>
        </div>

        {/* Student info */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Student</p>
          <p className="text-xl font-bold">{student?.name ?? 'Unknown'}</p>
          {student?.email && <p className="text-sm text-gray-500">{student.email}</p>}
        </div>

        {/* Scale scores summary */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Summary Scores</p>
          <div className="grid grid-cols-2 gap-3">
            {REVIEW_QUESTIONS.filter(q => q.type === 'scale').map(q => {
              const score = answerMap[q.key]
              const n = score ? Number(score) : null
              return (
                <div key={q.key} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{q.label.replace(' Rating', '')}</span>
                  <span className={`text-base font-bold ${
                    n === null ? 'text-gray-400' :
                    n >= 4 ? 'text-emerald-700' :
                    n >= 3 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {n !== null ? `${n}/5` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Text answers */}
        <div className="mb-6 space-y-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Review Notes</p>
          {REVIEW_QUESTIONS.filter(q => q.type === 'text').map(q => (
            <div key={q.key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{q.label}</p>
              <p className="text-sm text-gray-800 leading-relaxed">
                {answerMap[q.key] ?? <span className="text-gray-400 italic">Not recorded</span>}
              </p>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        {aiSummary && (
          <div className="border-t border-gray-200 pt-5 mb-6">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">AI-Generated Summary</p>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{aiSummary}</div>
          </div>
        )}

        {/* Signatures */}
        <div className="border-t border-gray-200 pt-6 mt-8 grid grid-cols-2 gap-8">
          <div>
            <div className="border-b border-gray-400 mb-2 h-10" />
            <p className="text-xs text-gray-500">Student signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-2 h-10" />
            <p className="text-xs text-gray-500">Coach / Reviewer signature</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-10">
          Tranmere Rovers FC Academy · Learner Review · {review.term}
        </p>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-page, .print-page * { visibility: visible; }
          .print-page { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #f3f4f6; }
          .print-page { box-shadow: 0 2px 16px rgba(0,0,0,0.10); background: white; }
        }
      `}</style>
    </>
  )
}
