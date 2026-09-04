'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { ChangePinForm } from './ChangePinForm'

/**
 * Dashboard nudge for accounts still on the shared default PIN (000000).
 * Expands inline into ChangePinForm — no navigation needed — and
 * disappears for the rest of the session once done.
 */
export function ChangePinPromptCard() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  if (done) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <KeyRound size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">You&apos;re using the shared default PIN</p>
          <p className="text-xs text-amber-700 mt-0.5">Set a personal one only you know — takes 10 seconds.</p>
        </div>
      </div>
      {open ? (
        <ChangePinForm onDone={() => setDone(true)} />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-700"
        >
          Set my PIN now
        </button>
      )}
    </div>
  )
}
