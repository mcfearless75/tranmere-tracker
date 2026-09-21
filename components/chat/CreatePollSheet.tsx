'use client'

import { useState } from 'react'
import {
  validatePollInput,
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  POLL_MAX_OPTIONS,
} from '@/lib/chat/types'

export type CreatePollSheetProps = {
  onSubmit: (question: string, options: string[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}

export function CreatePollSheet({ onSubmit, onClose }: CreatePollSheetProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function updateOption(index: number, value: string) {
    setOptions(prev => prev.map((o, i) => (i === index ? value : o)))
  }

  function addOption() {
    setOptions(prev => (prev.length < POLL_MAX_OPTIONS ? [...prev, ''] : prev))
  }

  async function handleSubmit() {
    if (busy) return

    const validationError = validatePollInput(question, options)
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const trimmedOptions = options.map(o => o.trim()).filter(Boolean)
      const result = await onSubmit(question.trim(), trimmedOptions)
      if (result.ok) {
        onClose()
      } else {
        setError(result.error ?? 'Something went wrong. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-3 mb-8 sm:mb-0 max-h-[85vh] overflow-y-auto rounded-2xl bg-neutral-900 text-white shadow-2xl">
        <div className="px-4 py-4 space-y-4">
          <h2 className="text-base font-semibold">New poll</h2>

          <div>
            <label htmlFor="poll-question" className="block text-sm font-medium text-white/80 mb-1">
              Question
            </label>
            <textarea
              id="poll-question"
              value={question}
              maxLength={POLL_QUESTION_MAX}
              rows={2}
              disabled={busy}
              onChange={e => {
                setQuestion(e.target.value)
                setError(null)
              }}
              placeholder="Ask something..."
              className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
            />
            <div className="mt-1 text-right text-xs text-white/50">
              {question.length}/{POLL_QUESTION_MAX}
            </div>
          </div>

          <div className="space-y-3">
            {options.map((value, index) => (
              <div key={index}>
                <label htmlFor={`poll-option-${index}`} className="block text-sm font-medium text-white/80 mb-1">
                  {`Option ${index + 1}`}
                </label>
                <input
                  id={`poll-option-${index}`}
                  type="text"
                  value={value}
                  maxLength={POLL_OPTION_MAX}
                  disabled={busy}
                  onChange={e => {
                    updateOption(index, e.target.value)
                    setError(null)
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                />
                <div className="mt-1 text-right text-xs text-white/50">
                  {value.length}/{POLL_OPTION_MAX}
                </div>
              </div>
            ))}
          </div>

          {options.length < POLL_MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              disabled={busy}
              className="text-sm font-medium text-white/70 active:text-white disabled:opacity-50"
            >
              Add option
            </button>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="w-full border-t border-white/10 px-4 py-3 text-center text-sm font-semibold disabled:opacity-50"
        >
          Post poll
        </button>
      </div>
    </div>
  )
}
