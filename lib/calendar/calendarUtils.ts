export type CalendarEvent = {
  date: string // YYYY-MM-DD
  label: string
  type: 'session' | 'match' | 'deadline' | 'event'
  time?: string
  description?: string
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

export type CalendarEventRow = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  description: string | null
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
 * Formats a Postgres 'HH:MM' or 'HH:MM:SS' time string as a friendly
 * 12-hour label, e.g. '18:30:00' -> '6:30pm', '09:00:00' -> '9am'.
 */
export function formatEventTime(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const period = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`
}

/**
 * Converts raw Supabase rows into a flat CalendarEvent array.
 */
export function getCalendarEvents(
  sessions: AttendanceSessionRow[],
  matches: MatchEventRow[],
  assignments: AssignmentRow[],
  calendarEvents: CalendarEventRow[] = [],
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

  const customEvents: CalendarEvent[] = calendarEvents.map(e => ({
    date: e.event_date,
    label: e.title,
    type: 'event',
    ...(e.event_time ? { time: formatEventTime(e.event_time) } : {}),
    ...(e.description ? { description: e.description } : {}),
  }))

  return [...sessionEvents, ...matchEvents, ...deadlineEvents, ...customEvents]
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
