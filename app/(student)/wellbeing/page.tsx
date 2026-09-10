'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  SURVEY_QUESTIONS,
  getScoreLabel,
  buildWellbeingTrend,
  CONTEXT_TAGS,
  type SurveyTrendPoint,
} from '@/lib/wellbeing/wellbeingUtils'
import { WellbeingTrendChart } from '@/components/wellbeing/WellbeingTrendChart'
import { CheckCircle2, ChevronRight } from 'lucide-react'

export default function WellbeingPage() {
  const [view, setView] = useState<'checkin' | 'trend'>('checkin')
  const [survey, setSurvey] = useState<{ id: string } | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [contextTags, setContextTags] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [trendData, setTrendData] = useState<SurveyTrendPoint[] | undefined>(undefined)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view !== 'trend' || trendData !== undefined) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return setTrendData([])
      supabase
        .from('wellbeing_surveys')
        .select('sent_at, wellbeing_responses(question_key, score)')
        .eq('student_id', user.id)
        .eq('status', 'completed')
        .order('sent_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          const rows = (data ?? []) as {
            sent_at: string
            wellbeing_responses: { question_key: string; score: number }[]
          }[]
          setTrendData(buildWellbeingTrend([...rows].reverse()))
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function handleSubmit() {
    if (!survey) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/wellbeing/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: survey.id, answers, notes, context_tags: contextTags }),
    })
    if (res.ok) {
      setDone(true)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
    }
    setSubmitting(false)
  }

  function toggleTag(tagKey: string) {
    setContextTags(prev => {
      if (prev.includes(tagKey)) return prev.filter(t => t !== tagKey)
      if (prev.length >= 2) return prev
      return [...prev, tagKey]
    })
  }

  let checkinBody: JSX.Element
  if (survey === undefined) {
    checkinBody = <p className="text-center text-muted-foreground py-12">Loading...</p>
  } else if (survey === null) {
    checkinBody = (
      <div className="text-center py-12 space-y-2">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-gray-800">No survey open right now</p>
        <p className="text-sm text-muted-foreground">Your next check-in will arrive on a Monday.</p>
      </div>
    )
  } else if (done) {
    checkinBody = (
      <div className="text-center py-12 space-y-3">
        <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
        <p className="text-xl font-bold text-gray-900">Thanks for checking in 💙</p>
        <p className="text-sm text-muted-foreground">Your responses have been saved. See you next week.</p>
      </div>
    )
  } else {
    const isChipStep = step === SURVEY_QUESTIONS.length
    const q = isChipStep ? null : SURVEY_QUESTIONS[step]
    const isLast = isChipStep
    const canAdvance = isChipStep ? true : answers[q!.key] !== undefined

    checkinBody = (
      <div className="space-y-6">
        {/* Progress — one segment per scored question, plus one for the chip screen */}
        <div className="flex gap-1.5">
          {[...SURVEY_QUESTIONS, null].map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-tranmere-blue' : i === step ? 'bg-tranmere-blue/50' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {isChipStep ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5 shadow-sm">
            <div className="text-center space-y-2">
              <p className="text-4xl">🤔</p>
              <p className="text-base font-semibold text-gray-900">What&apos;s been on your mind most this week?</p>
              <p className="text-xs text-muted-foreground">Pick up to two — or skip</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {CONTEXT_TAGS.map(tag => (
                <button
                  key={tag.key}
                  onClick={() => toggleTag(tag.key)}
                  disabled={!contextTags.includes(tag.key) && contextTags.length >= 2}
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all disabled:opacity-40 ${
                    contextTags.includes(tag.key)
                      ? 'border-tranmere-blue bg-tranmere-blue text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-tranmere-blue/50'
                  }`}
                >
                  <span aria-hidden="true">{tag.emoji}</span> {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5 shadow-sm">
            <div className="text-center space-y-2">
              <p className="text-4xl">{q!.emoji}</p>
              <p className="text-base font-semibold text-gray-900">{q!.label}</p>
              <p className="text-xs text-muted-foreground">
                Question {step + 1} of {SURVEY_QUESTIONS.length}
              </p>
            </div>

            {/* Score buttons */}
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  onClick={() => setAnswers(a => ({ ...a, [q!.key]: score }))}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 border-2 transition-all text-sm font-bold ${
                    answers[q!.key] === score
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
                {getScoreLabel(q!.key, answers[q!.key])}
              </p>
            )}

            {/* Optional note */}
            <div>
              <textarea
                placeholder="Any notes? (optional)"
                value={notes[q!.key] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [q!.key]: e.target.value }))}
                rows={2}
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-tranmere-blue/30"
              />
            </div>
          </div>
        )}

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
              disabled={submitting}
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

  return (
    <div className="max-w-lg mx-auto space-y-4 py-4">
      {/* Header — now shown for every state, not only the form (previously the
          loading/idle/done states had no title at all) */}
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Wellbeing Check-in</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Takes about 90 seconds · Every week</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setView('checkin')}
          className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            view === 'checkin' ? 'border-tranmere-blue text-tranmere-blue' : 'border-transparent text-muted-foreground'
          }`}
        >
          Check-in
        </button>
        <button
          onClick={() => setView('trend')}
          className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            view === 'trend' ? 'border-tranmere-blue text-tranmere-blue' : 'border-transparent text-muted-foreground'
          }`}
        >
          My Trend
        </button>
      </div>

      {view === 'trend' ? (
        trendData === undefined ? (
          <p className="text-center text-muted-foreground py-12">Loading...</p>
        ) : (
          <WellbeingTrendChart data={trendData} />
        )
      ) : (
        checkinBody
      )}
    </div>
  )
}
