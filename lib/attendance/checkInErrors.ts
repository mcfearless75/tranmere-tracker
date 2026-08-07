/**
 * Maps raw Postgres error text from the submit_daily_check_in RPC
 * (supabase/migrations/040_lunch_phase.sql) to student-friendly messages and
 * sensible HTTP statuses. Students should never see raw Postgres text.
 */

export type FriendlyCheckInError = {
  message: string
  status: number
}

const PHASE_LABELS: Record<string, string> = {
  morning: 'Morning',
  lunch: 'Lunch',
  afternoon: 'Afternoon',
}

/**
 * The RPC raises e.g.:
 *   'Invalid check-in token'
 *   'Outside lunch check-in window (11:00:00 – 14:30:00)'
 *   'Not authenticated'
 *   'Invalid phase: xx'
 */
export function friendlyCheckInError(raw: string | null | undefined): FriendlyCheckInError {
  const msg = raw ?? ''

  if (msg.includes('Invalid check-in token')) {
    return {
      message: "That sticker isn't recognised — please tap the official sticker at reception.",
      status: 403,
    }
  }

  const win = msg.match(
    /Outside (morning|lunch|afternoon) check-in window \((\d{1,2}:\d{2})(?::\d{2})?\s*[–-]\s*(\d{1,2}:\d{2})(?::\d{2})?\)/
  )
  if (win) {
    const label = PHASE_LABELS[win[1]] ?? 'This'
    return {
      message: `${label} check-in isn't open right now — it runs ${win[2]} to ${win[3]}.`,
      status: 422,
    }
  }
  // Window error whose times we couldn't parse — still keep it friendly.
  if (msg.includes('check-in window')) {
    return {
      message: "Check-in isn't open right now — please try again during the check-in window.",
      status: 422,
    }
  }

  if (msg.includes('Not authenticated')) {
    return { message: 'Your session has expired — please sign in again.', status: 401 }
  }

  if (msg.includes('Invalid phase')) {
    return { message: 'Invalid check-in phase.', status: 400 }
  }

  return {
    message: 'Check-in failed — please try again, or see a member of staff.',
    status: 400,
  }
}
