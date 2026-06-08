import {
  getDaysInMonth,
  getCalendarEvents,
  groupEventsByDate,
  type CalendarEvent,
} from '@/lib/calendar/calendarUtils'

describe('getDaysInMonth', () => {
  it('returns 31 for January', () => {
    expect(getDaysInMonth(2024, 1)).toBe(31)
  })

  it('returns 28 for February in a non-leap year', () => {
    expect(getDaysInMonth(2023, 2)).toBe(28)
  })

  it('returns 29 for February in a leap year', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29)
  })

  it('returns 30 for April', () => {
    expect(getDaysInMonth(2024, 4)).toBe(30)
  })

  it('returns 31 for December', () => {
    expect(getDaysInMonth(2024, 12)).toBe(31)
  })
})

describe('getCalendarEvents', () => {
  it('maps attendance sessions to session events', () => {
    const sessions = [
      {
        scheduled_date: '2024-06-10',
        session_label: 'Morning Training',
        session_type: 'training',
        opens_at: '2024-06-10T09:00:00Z',
        closes_at: '2024-06-10T10:00:00Z',
      },
    ]
    const result = getCalendarEvents(sessions, [], [])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<CalendarEvent>({
      date: '2024-06-10',
      label: 'Morning Training',
      type: 'session',
    })
  })

  it('maps match events to match events', () => {
    const matches = [
      { match_date: '2024-06-15', opponent: 'Chester FC', location: 'Prenton Park' },
    ]
    const result = getCalendarEvents([], matches, [])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<CalendarEvent>({
      date: '2024-06-15',
      label: 'vs Chester FC',
      type: 'match',
    })
  })

  it('maps assignments to deadline events', () => {
    const assignments = [
      { due_date: '2024-06-20', title: 'Nutrition Report' },
    ]
    const result = getCalendarEvents([], [], assignments)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject<CalendarEvent>({
      date: '2024-06-20',
      label: 'Nutrition Report',
      type: 'deadline',
    })
  })

  it('combines all three event types', () => {
    const sessions = [{ scheduled_date: '2024-06-10', session_label: 'AM Session', session_type: 'training', opens_at: '2024-06-10T09:00:00Z', closes_at: null }]
    const matches = [{ match_date: '2024-06-15', opponent: 'Wrexham', location: 'Away' }]
    const assignments = [{ due_date: '2024-06-20', title: 'Essay' }]
    const result = getCalendarEvents(sessions, matches, assignments)
    expect(result).toHaveLength(3)
    const types = result.map(e => e.type)
    expect(types).toContain('session')
    expect(types).toContain('match')
    expect(types).toContain('deadline')
  })

  it('returns empty array when all inputs empty', () => {
    expect(getCalendarEvents([], [], [])).toHaveLength(0)
  })

  it('falls back to session_type as label when session_label is missing', () => {
    const sessions = [
      {
        scheduled_date: '2024-06-10',
        session_label: '',
        session_type: 'match',
        opens_at: '2024-06-10T09:00:00Z',
        closes_at: null,
      },
    ]
    const result = getCalendarEvents(sessions, [], [])
    expect(result[0].label).toBe('match')
  })
})

describe('groupEventsByDate', () => {
  it('groups events under their date key', () => {
    const events: CalendarEvent[] = [
      { date: '2024-06-10', label: 'Morning Training', type: 'session' },
      { date: '2024-06-10', label: 'Essay due', type: 'deadline' },
      { date: '2024-06-15', label: 'vs Chester', type: 'match' },
    ]
    const grouped = groupEventsByDate(events)
    expect(grouped['2024-06-10']).toHaveLength(2)
    expect(grouped['2024-06-15']).toHaveLength(1)
  })

  it('returns empty object for empty input', () => {
    expect(groupEventsByDate([])).toEqual({})
  })

  it('preserves event order within each date', () => {
    const events: CalendarEvent[] = [
      { date: '2024-06-10', label: 'First', type: 'session' },
      { date: '2024-06-10', label: 'Second', type: 'deadline' },
    ]
    const grouped = groupEventsByDate(events)
    expect(grouped['2024-06-10'][0].label).toBe('First')
    expect(grouped['2024-06-10'][1].label).toBe('Second')
  })

  it('each date key only contains events for that date', () => {
    const events: CalendarEvent[] = [
      { date: '2024-06-01', label: 'A', type: 'session' },
      { date: '2024-06-02', label: 'B', type: 'match' },
    ]
    const grouped = groupEventsByDate(events)
    expect(grouped['2024-06-01'].every(e => e.date === '2024-06-01')).toBe(true)
    expect(grouped['2024-06-02'].every(e => e.date === '2024-06-02')).toBe(true)
  })
})
