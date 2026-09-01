import { getSlotsDueForReminder, DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

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
  it('labels Monday, Tuesday, Thursday and Friday only', () => {
    expect(DAY_LABELS).toEqual({ 1: 'Monday', 2: 'Tuesday', 4: 'Thursday', 5: 'Friday' })
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
