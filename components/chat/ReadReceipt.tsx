'use client'

import { useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'

/** DM receipt: ✓ sent, ✓✓ (bright) read. Sits on the blue "mine" bubble. */
export function DmReceipt({ read }: { read: boolean }) {
  return read ? (
    <CheckCheck size={13} className="text-sky-300" aria-label="Read" data-testid="receipt-read" />
  ) : (
    <Check size={13} aria-label="Sent" data-testid="receipt-sent" />
  )
}

/** Group receipt for staff: "Seen 7/15", tap to see who has and hasn't. */
export function GroupReceipt({ readBy, unreadBy }: { readBy: string[]; unreadBy: string[] }) {
  const [open, setOpen] = useState(false)
  const total = readBy.length + unreadBy.length
  if (total === 0) return null
  const allRead = unreadBy.length === 0
  return (
    <span className="relative">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`inline-flex items-center gap-0.5 underline-offset-2 hover:underline ${allRead ? 'text-sky-300' : ''}`}
        aria-label={`Seen by ${readBy.length} of ${total}`}
        aria-expanded={open}
      >
        <CheckCheck size={12} />
        {readBy.length}/{total}
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute right-0 bottom-full mb-1 z-20 w-48 max-h-60 overflow-y-auto rounded-lg border bg-white p-2 text-left text-xs text-gray-700 shadow-lg"
          onClick={e => e.stopPropagation()}
        >
          <span className="block font-semibold text-gray-900 mb-1">Seen ({readBy.length})</span>
          {readBy.length ? readBy.map((n, i) => <span key={`r-${i}`} className="block truncate">{n}</span>)
            : <span className="block text-gray-400">No one yet</span>}
          {unreadBy.length > 0 && (
            <>
              <span className="block font-semibold text-gray-900 mt-2 mb-1">Not yet ({unreadBy.length})</span>
              {unreadBy.map((n, i) => <span key={`u-${i}`} className="block truncate text-gray-500">{n}</span>)}
            </>
          )}
        </span>
      )}
    </span>
  )
}
