import { getSlotsDueForReminder, getSlotsForDate, timetableSlotToSession, DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

function makeSlot(overrides: Partial<TimetableSlotRow> = {}): TimetableSlotRow {
  return {
    id: 'slot1',
    year_group: 1,
    day_of_week: 1,
    start_time: '10:00:00',
    end_time: '11:00:00',
    title: 'Football 1',
    location: 'Pitch 1',
    ...overrides,
  }
}

describe('DAY_LABELS', () => {
  it('labels all five weekdays, including Wednesday', () => {
    expect(DAY_LABELS).toEqual({ 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' })
  })
})

describe('getSlotsDueForReminder', () => {
  it('includes a slot starting in 15 minutes (during GMT, no offset)', () => {
    const slot = makeSlot({ start_time: '09:15:00' })
    const now = new Date('2026-01-12T09:00:00Z') // GMT, so 09:00 UTC = 09:00 London
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([slot])
  })

  it('excludes a slot starting in only 5 minutes (too soon)', () => {
    const slot = makeSlot({ start_time: '09:05:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([])
  })

  it('excludes a slot starting in 25 minutes (too far out)', () => {
    const slot = makeSlot({ start_time: '09:25:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([])
  })

  it('includes a slot at the near edge of the window (13 minutes out)', () => {
    const slot = makeSlot({ start_time: '09:13:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([slot])
  })

  it('excludes a slot at the far edge of the window (18 minutes out, exclusive)', () => {
    const slot = makeSlot({ start_time: '09:18:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-01-12')).toEqual([])
  })

  it('accounts for BST when comparing against the London wall-clock start time', () => {
    // 08:15 UTC during BST = 09:15 London, so this is "in 15 minutes" from 08:00 UTC (=09:00 London)
    const slot = makeSlot({ start_time: '09:15:00' })
    const now = new Date('2026-08-10T08:00:00Z')
    expect(getSlotsDueForReminder([slot], now, '2026-08-10')).toEqual([slot])
  })

  it('returns multiple due slots and skips non-due ones', () => {
    const due = makeSlot({ id: 'due', start_time: '09:15:00' })
    const notDue = makeSlot({ id: 'not-due', start_time: '11:00:00' })
    const now = new Date('2026-01-12T09:00:00Z')
    expect(getSlotsDueForReminder([due, notDue], now, '2026-01-12')).toEqual([due])
  })
})

// Regression: the student dashboard's "Today" hero card only ever queried
// attendance_sessions (the older PIN-session system), which has zero rows
// on most days now that timetable_slots is the real weekly schedule — every
// student saw "No sessions today — day off" regardless of their actual
// timetable. Confirmed live 2026-09-08 against a real student (Caleb
// McWilliam, year_group 1) who had three real Tuesday sessions
// (Analysis 10-11, Training 11-12, BTEC 13-15) while attendance_sessions
// had none for that date.
describe('getSlotsForDate', () => {
  it('matches Tuesday 2026-09-08 to day_of_week 2 (the live incident date)', () => {
    const analysis = makeSlot({ id: 'analysis', day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00', title: 'Analysis' })
    const training = makeSlot({ id: 'training', day_of_week: 2, start_time: '11:00:00', end_time: '12:00:00', title: 'Training' })
    const wednesdaySlot = makeSlot({ id: 'wed', day_of_week: 3, title: 'Match Day' })
    expect(getSlotsForDate([analysis, training, wednesdaySlot], '2026-09-08')).toEqual([analysis, training])
  })

  it('returns nothing for a weekday with no slots', () => {
    const mondaySlot = makeSlot({ day_of_week: 1 })
    expect(getSlotsForDate([mondaySlot], '2026-09-08')).toEqual([])
  })
})

describe('timetableSlotToSession', () => {
  it('shapes a timetable slot like an attendance_sessions row the dashboard already renders', () => {
    const slot = makeSlot({ id: 'analysis', title: 'Analysis', location: null, start_time: '10:00:00', end_time: '11:00:00' })
    const session = timetableSlotToSession(slot, '2026-09-08')
    expect(session).toEqual({
      id: 'timetable-analysis',
      session_label: 'Analysis',
      session_type: 'class',
      opens_at: new Date('2026-09-08T09:00:00.000Z').toISOString(), // 10:00 BST = 09:00 UTC
      closes_at: new Date('2026-09-08T10:00:00.000Z').toISOString(),
    })
  })

  it('appends the location to the label when present', () => {
    const slot = makeSlot({ title: 'BTEC: Employability and Careers', location: 'Tranmere Room 2' })
    expect(timetableSlotToSession(slot, '2026-09-08').session_label).toBe('BTEC: Employability and Careers — Tranmere Room 2')
  })
})
