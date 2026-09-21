'use client'

import type { Poll, PollOption } from '@/lib/chat/types'

export type PollVoter = { userId: string; name: string; optionId: string }

export type PollCardProps = {
  poll: Poll
  options: PollOption[] // caller sorts by position
  myOptionId: string | null
  isChatStaff: boolean
  voters?: PollVoter[] // staff only; undefined for students
  busy?: boolean
  onVote: (optionId: string) => void
  onClose: () => void
  onShowVoters?: () => void
}

/** "No votes yet" / "1 vote" / "N votes" — singular/plural matters here. */
function totalLabel(total: number): string {
  if (total === 0) return 'No votes yet'
  if (total === 1) return '1 vote'
  return `${total} votes`
}

/** Names of everyone who chose this option, in the order the caller supplied
 *  them. Only ever called when `voters` is defined — students never see it,
 *  since the RLS policy on chat_poll_votes never hands them a voters list. */
function namesFor(voters: PollVoter[], optionId: string): string {
  return voters.filter(v => v.optionId === optionId).map(v => v.name).join(', ')
}

export function PollCard({
  poll,
  options,
  myOptionId,
  isChatStaff,
  voters,
  busy = false,
  onVote,
  onClose,
  onShowVoters,
}: PollCardProps) {
  const closed = poll.closed_at !== null
  const total = options.reduce((sum, o) => sum + o.vote_count, 0)

  return (
    <div className="rounded-xl border bg-white/95 text-gray-900 p-3 w-full max-w-full">
      <p className="text-sm font-semibold break-words">{poll.question}</p>

      <div className="mt-2 flex flex-col gap-1.5">
        {options.map(option => {
          const mine = myOptionId === option.id
          const pct = total === 0 ? 0 : (option.vote_count / total) * 100
          const voterNames = voters ? namesFor(voters, option.id) : ''

          return (
            <div key={option.id}>
              <button
                type="button"
                aria-pressed={mine}
                disabled={closed || busy}
                onClick={() => onVote(option.id)}
                className={`relative w-full overflow-hidden rounded-lg border text-left text-sm disabled:cursor-not-allowed ${
                  mine ? 'border-tranmere-blue' : 'border-gray-200'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-tranmere-blue/15"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
                <span className="relative flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="break-words">{option.label}</span>
                  <span className="shrink-0 text-[11px] text-gray-500">{option.vote_count}</span>
                </span>
              </button>
              {voters && voterNames && (
                <p className="mt-0.5 px-1 text-[11px] text-gray-500 break-words">{voterNames}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span>{totalLabel(total)}</span>
        {closed && <span>Poll closed</span>}
      </div>

      {(isChatStaff && !closed) || (isChatStaff && onShowVoters && !voters) ? (
        <div className="mt-2 flex items-center gap-3 text-[11px] font-medium">
          {isChatStaff && !closed && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Close poll
            </button>
          )}
          {isChatStaff && onShowVoters && !voters && (
            <button type="button" onClick={onShowVoters} className="text-tranmere-blue">
              See who voted
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
