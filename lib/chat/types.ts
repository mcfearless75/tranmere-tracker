/** Limits mirrored by the DB check constraints in migration 082 and by the
 *  CreatePollSheet maxLength attributes. Change all three together. */
export const POLL_QUESTION_MAX = 200
export const POLL_OPTION_MAX = 80
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6

export type ChatMessage = {
  id: string
  sender_id: string
  body: string | null
  attachment_url: string | null
  attachment_kind: string | null
  created_at: string
  reply_to_id: string | null
  poll_id: string | null
}

/** A message quoted by a reply. Kept deliberately narrow — a quote shows a
 *  name and one line, never the full message. */
export type ReplyParent = {
  id: string
  sender_id: string
  body: string | null
  attachment_kind: string | null
  deleted_at: string | null
}

export type Poll = {
  id: string
  room_id: string
  created_by: string
  question: string
  closed_at: string | null
  created_at: string
}

export type PollOption = {
  id: string
  poll_id: string
  label: string
  position: number
  vote_count: number
}

export type PollVote = {
  id: string
  poll_id: string
  option_id: string
  user_id: string
}

/** Returns an error message, or null when the input is valid.
 *  Used by both CreatePollSheet (for inline feedback) and createPoll (which
 *  must not trust the client). */
export function validatePollInput(question: string, options: string[]): string | null {
  const q = question.trim()
  if (!q) return 'Add a question'
  if (q.length > POLL_QUESTION_MAX) {
    return `Question must be ${POLL_QUESTION_MAX} characters or fewer`
  }

  const filled = options.map(o => o.trim()).filter(Boolean)
  if (filled.length < POLL_MIN_OPTIONS) return `Add at least ${POLL_MIN_OPTIONS} options`
  if (filled.length > POLL_MAX_OPTIONS) return `Use ${POLL_MAX_OPTIONS} options or fewer`
  if (filled.some(o => o.length > POLL_OPTION_MAX)) {
    return `Each option must be ${POLL_OPTION_MAX} characters or fewer`
  }

  const seen = new Set(filled.map(o => o.toLowerCase()))
  if (seen.size !== filled.length) return 'Options must be different'

  return null
}
