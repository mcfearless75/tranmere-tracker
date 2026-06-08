'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { REVIEW_QUESTIONS, SCALE_QUESTIONS, validateReviewAnswers } from '@/lib/learnerReview/reviewUtils'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'

const CURRENT_TERM = (() => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= 9)  return `Autumn ${year}`
  if (month >= 1 && month <= 3) return `Spring ${year}`
  return `Summer ${year}`
})()

const SCALE_LABELS = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent']

interface Props {
  params: { id: string }
  searchParams: { name?: string }
}

export default function NewLearnerReviewPage({ params, searchParams }: Props) {
  const studentId   = params.id
  const studentName = searchParams.name ?? 'Student'
  const router      = useRouter()

  const [answers, setAnswers]       = useState<Record<string, string | number>>({})
  const [term, setTerm]             = useState(CURRENT_TERM)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reviewId, setReviewId]     = useState<string | null>(null)
  const [summary, setSummary]       = useState<string | null>(null)
  const [error, setError]           = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const canSave   = validateReviewAnswers(answers)
  const isSaved   = !!reviewId
  const isScaleQ  = (key: string) => SCALE_QUESTIONS.some(q => q.key === key)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create review row
      const { data: review, error: reviewErr } = await supabase
        .from('learner_reviews')
        .insert({ student_id: studentId, reviewer_id: user.id, term, status: 'submitted' })
        .select('id')
        .single()

      if (reviewErr || !review) throw new Error(reviewErr?.message ?? 'Failed to create review')

      // Insert answers
      const rows = Object.entries(answers).map(([question_key, answer]) => ({
        review_id: review.id,
        question_key,
        answer: String(answer),
      }))

      const { error: answersErr } = await supabase.from('review_answers').insert(rows)
      if (answersErr) throw new Error(answersErr.message)

      setReviewId(review.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateSummary() {
    if (!reviewId) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/ai/learner-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: reviewId, student_id: studentId, student_name: studentName, term, answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI generation failed')
      setSummary(data.summary.text)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 px-4">
      <Link href={`/admin/students/${studentId}`} className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Back to {studentName}
      </Link>

      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Learner Review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{studentName}</p>
      </div>

      {/* Term selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Term</label>
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
          placeholder="e.g. Autumn 2025"
        />
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {REVIEW_QUESTIONS.map(q => (
          <div key={q.key} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">{q.label}</p>

            {q.type === 'scale' ? (
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers(a => ({ ...a, [q.key]: n }))}
                    className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 border-2 text-xs font-bold transition-all ${
                      answers[q.key] === n
                        ? 'border-tranmere-blue bg-tranmere-blue text-white shadow-sm scale-105'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-tranmere-blue/40'
                    }`}
                  >
                    <span className="text-base">{n}</span>
                    {answers[q.key] === n && (
                      <span className="text-[9px] font-normal leading-tight text-center px-0.5">{SCALE_LABELS[n]}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                rows={3}
                value={(answers[q.key] as string) ?? ''}
                onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                placeholder="Enter notes from the 1-to-1…"
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        {!isSaved ? (
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Review'}
          </button>
        ) : (
          <button
            onClick={handleGenerateSummary}
            disabled={generating}
            className="flex-1 py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {generating
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><Sparkles size={15} /> Generate AI Summary</>
            }
          </button>
        )}
        {isSaved && !summary && (
          <button
            onClick={() => router.push(`/admin/students/${studentId}`)}
            className="py-3 px-4 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700"
          >
            Skip Summary
          </button>
        )}
      </div>

      {/* AI Summary */}
      {summary && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-tranmere-blue" />
            <h3 className="font-semibold text-sm text-tranmere-blue">AI Summary</h3>
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{summary}</div>
          <button
            onClick={() => router.push(`/admin/students/${studentId}`)}
            className="w-full py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold"
          >
            Done — Back to Student
          </button>
        </div>
      )}
    </div>
  )
}
