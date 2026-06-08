export type CalendarEvent = {
  date: string // YYYY-MM-DD
  label: string
  type: 'session' | 'match' | 'deadline'
}

export type AttendanceSessionRow = {
  scheduled_date: string
  session_label: string
  session_type: string
  opens_at: string
  closes_at: string | null
}

export type MatchEventRow = {
  match_date: string
  opponent: string
  location: string | null
}

export type AssignmentRow = {
  due_date: string
  title: string
}

/**
 * Returns the number of days in a given month.
 * @param year  Full year, e.g. 2024
 * @param month 1-based month, e.g. 1 = January
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Converts raw Supabase rows into a flat CalendarEvent array.
 */
export function getCalendarEvents(
  sessions: AttendanceSessionRow[],
  matches: MatchEventRow[],
  assignments: AssignmentRow[],
): CalendarEvent[] {
  const sessionEvents: CalendarEvent[] = sessions.map(s => ({
    date: s.scheduled_date,
    label: s.session_label || s.session_type,
    type: 'session',
  }))

  const matchEvents: CalendarEvent[] = matches.map(m => ({
    date: m.match_date,
    label: `vs ${m.opponent}`,
    type: 'match',
  }))

  const deadlineEvents: CalendarEvent[] = assignments.map(a => ({
    date: a.due_date,
    label: a.title,
    type: 'deadline',
  }))

  return [...sessionEvents, ...matchEvents, ...deadlineEvents]
}

/**
 * Groups a flat CalendarEvent array by date string (YYYY-MM-DD).
 */
export function groupEventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = []
    }
    acc[event.date].push(event)
    return acc
  }, {})
}
