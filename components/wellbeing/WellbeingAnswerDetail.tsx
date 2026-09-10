'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SURVEY_QUESTIONS, getScoreLabel } from '@/lib/wellbeing/wellbeingUtils'

type Response = { question_key: string; score: number; note: string | null }

/**
 * The compact score grid on the admin wellbeing card only ever shows a bare
 * number (e.g. "4") — staff asked to see what a student actually clicked,
 * not just the score. This expands to the same direction-aware wording the
 * student saw while answering (getScoreLabel — "Very" for a 4 on stress,
 * not the generic "Good"), one row per question, "Not answered" for any the
 * student skipped.
 */
export function WellbeingAnswerDetail({ responses }: { responses: Response[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-medium text-tranmere-blue hover:underline"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {open ? 'Hide answers' : 'See what they answered'}
      </button>

      {open && (
        <div className="mt-2 space-y-1 rounded-xl bg-gray-50 border border-gray-200 p-3">
          {SURVEY_QUESTIONS.map(q => {
            const r = responses.find(x => x.question_key === q.key)
            return (
              <p key={q.key} className="text-xs text-gray-700 flex items-baseline justify-between gap-2">
                <span>{q.emoji} {q.label}</span>
                <span className="font-medium text-gray-900 shrink-0 text-right">
                  {r ? `${r.score} · ${getScoreLabel(q.key, r.score)}` : 'Not answered'}
                </span>
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
