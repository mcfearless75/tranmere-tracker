'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { SURVEY_QUESTIONS } from '@/lib/wellbeing/wellbeingUtils'
import { CheckCircle2, ChevronRight } from 'lucide-react'

const SCORE_LABELS = ['', 'Very Low', 'Low', 'Okay', 'Good', 'Great']

export default function WellbeingPage() {
  const [survey, setSurvey] = useState<{ id: string } | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return setSurvey(null)
      supabase
        .from('wellbeing_surveys')
        .select('id')
        .eq('student_id', user.id)
        .eq('status', 'open')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setSurvey(data))
    })
  }, [])

  async function handleSubmit() {
    if (!survey) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/wellbeing/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: survey.id, answers, notes }),
    })
    if (res.ok) {
      setDone(true)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
    }
    setSubmitting(false)
  }

  if (survey === undefined) {
    return <p className="text-center text-muted-foreground py-12">Loading...</p>
  }

  if (survey === null || !survey) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-gray-800">No survey open right now</p>
        <p className="text-sm text-muted-foreground">Your next check-in will arrive on a Monday.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center py-12 space-y-3">
        <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
        <p className="text-xl font-bold text-gray-900">Thanks for checking in 💙</p>
        <p className="text-sm text-muted-foreground">Your responses have been saved. See you in two weeks.</p>
      </div>
    )
  }

  const q = SURVEY_QUESTIONS[step]
  const isLast = step === SURVEY_QUESTIONS.length - 1
  const canAdvance = answers[q.key] !== undefined

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Wellbeing Check-in</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Takes about 60 seconds · Every two weeks</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {SURVEY_QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-tranmere-blue' : i === step ? 'bg-tranmere-blue/50' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5 shadow-sm">
        <div className="text-center space-y-2">
          <p className="text-4xl">{q.emoji}</p>
          <p className="text-base font-semibold text-gray-900">{q.label}</p>
          <p className="text-xs text-muted-foreground">
            Question {step + 1} of {SURVEY_QUESTIONS.length}
          </p>
        </div>

        {/* Score buttons */}
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(score => (
            <button
              key={score}
              onClick={() => setAnswers(a => ({ ...a, [q.key]: score }))}
              className={`flex flex-col items-center gap-1 rounded-xl py-3 border-2 transition-all text-sm font-bold ${
                answers[q.key] === score
                  ? 'border-tranmere-blue bg-tranmere-blue text-white shadow-md scale-105'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-tranmere-blue/50'
              }`}
            >
              {score}
            </button>
          ))}
        </div>

        {/* Score label */}
        {canAdvance && (
          <p className="text-center text-sm text-muted-foreground">
            {SCORE_LABELS[answers[q.key]]}
          </p>
        )}

        {/* Optional note */}
        <div>
          <textarea
            placeholder="Any notes? (optional)"
            value={notes[q.key] ?? ''}
            onChange={e => setNotes(n => ({ ...n, [q.key]: e.target.value }))}
            rows={2}
            className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700"
          >
            Back
          </button>
        )}
        {isLast ? (
          <button
            disabled={!canAdvance || submitting}
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? 'Submitting…' : 'Submit ✓'}
          </button>
        ) : (
          <button
            disabled={!canAdvance}
            onClick={() => setStep(s => s + 1)}
            className="flex-1 py-3 rounded-2xl bg-tranmere-blue text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            Next <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
