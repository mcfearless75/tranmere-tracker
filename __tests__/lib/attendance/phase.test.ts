import {
  toMinutes,
  londonMinutes,
  inWindow,
  decidePhase,
  fallbackPartitionPhase,
  PHASE_LABELS,
  type PhaseWindows,
} from '@/lib/attendance/phase'

const WINDOWS: PhaseWindows = {
  am:    { start: '07:30:00', end: '10:30:00' },
  lunch: { start: '11:30:00', end: '13:30:00' },
  pm:    { start: '14:30:00', end: '17:30:00' },
}

// Helper: a Date whose Europe/London wall-clock is the given time.
// Summer dates are BST (UTC+1), winter dates are GMT (UTC+0).
const bst = (hhmm: string) => new Date(`2026-08-07T${hhmm}:00+01:00`)
const gmt = (hhmm: string) => new Date(`2026-01-15T${hhmm}:00+00:00`)

describe('toMinutes', () => {
  it('parses HH:MM:SS', () => {
    expect(toMinutes('10:30:00')).toBe(630)
  })
  it('parses HH:MM', () => {
    expect(toMinutes('07:30')).toBe(450)
  })
})

describe('londonMinutes', () => {
  it('converts a BST instant to London wall-clock minutes', () => {
    // 08:00 UTC in August is 09:00 in London
    expect(londonMinutes(new Date('2026-08-07T08:00:00Z'))).toBe(540)
  })
  it('converts a GMT instant to London wall-clock minutes', () => {
    // 08:00 UTC in January is 08:00 in London
    expect(londonMinutes(new Date('2026-01-15T08:00:00Z'))).toBe(480)
  })
})

describe('decidePhase', () => {
  it('returns am inside the morning window', () => {
    expect(decidePhase(WINDOWS, bst('08:15'))).toBe('am')
  })
  it('returns lunch inside the lunch window', () => {
    expect(decidePhase(WINDOWS, bst('12:00'))).toBe('lunch')
  })
  it('returns pm inside the afternoon window', () => {
    expect(decidePhase(WINDOWS, bst('16:00'))).toBe('pm')
  })
  it('is inclusive at window boundaries', () => {
    expect(decidePhase(WINDOWS, bst('07:30'))).toBe('am')
    expect(decidePhase(WINDOWS, bst('10:30'))).toBe('am')
    expect(decidePhase(WINDOWS, bst('11:30'))).toBe('lunch')
    expect(decidePhase(WINDOWS, bst('13:30'))).toBe('lunch')
    expect(decidePhase(WINDOWS, bst('14:30'))).toBe('pm')
    expect(decidePhase(WINDOWS, bst('17:30'))).toBe('pm')
  })
  it('returns null in the gap between am and lunch', () => {
    expect(decidePhase(WINDOWS, bst('11:00'))).toBeNull()
  })
  it('returns null in the gap between lunch and pm', () => {
    expect(decidePhase(WINDOWS, bst('14:00'))).toBeNull()
  })
  it('returns null out of hours', () => {
    expect(decidePhase(WINDOWS, bst('06:00'))).toBeNull()
    expect(decidePhase(WINDOWS, bst('19:00'))).toBeNull()
  })
  it('uses London wall-clock, not the raw UTC hour (BST offset)', () => {
    // 06:45 UTC in August = 07:45 London → inside the am window
    expect(decidePhase(WINDOWS, new Date('2026-08-07T06:45:00Z'))).toBe('am')
    // 17:00 UTC in August = 18:00 London → out of hours
    expect(decidePhase(WINDOWS, new Date('2026-08-07T17:00:00Z'))).toBeNull()
  })
  it('agrees with the wall-clock in winter (GMT)', () => {
    expect(decidePhase(WINDOWS, gmt('08:00'))).toBe('am')
    expect(decidePhase(WINDOWS, gmt('12:30'))).toBe('lunch')
  })
})

describe('inWindow', () => {
  it('matches decidePhase for a single window', () => {
    expect(inWindow(WINDOWS.lunch, bst('12:00'))).toBe(true)
    expect(inWindow(WINDOWS.lunch, bst('11:00'))).toBe(false)
  })
})

describe('fallbackPartitionPhase', () => {
  const mins = (h: number, m: number) => h * 60 + m

  it('is am before 11:00', () => {
    expect(fallbackPartitionPhase(mins(8, 0))).toBe('am')
    expect(fallbackPartitionPhase(mins(10, 59))).toBe('am')
  })
  it('is lunch from 11:00 to 14:30 inclusive', () => {
    expect(fallbackPartitionPhase(mins(11, 0))).toBe('lunch')
    expect(fallbackPartitionPhase(mins(14, 30))).toBe('lunch')
  })
  it('is pm after 14:30', () => {
    expect(fallbackPartitionPhase(mins(14, 31))).toBe('pm')
    expect(fallbackPartitionPhase(mins(17, 0))).toBe('pm')
  })
  it('never fires overnight (outside 07:00–18:00)', () => {
    expect(fallbackPartitionPhase(mins(3, 0))).toBeNull()
    expect(fallbackPartitionPhase(mins(6, 59))).toBeNull()
    expect(fallbackPartitionPhase(mins(18, 1))).toBeNull()
    expect(fallbackPartitionPhase(mins(23, 30))).toBeNull()
  })
})

describe('PHASE_LABELS', () => {
  it('has the agreed UI labels for all three phases', () => {
    expect(PHASE_LABELS).toEqual({
      am: 'Morning check-in',
      lunch: 'Lunch check-in',
      pm: 'End of day check-out',
    })
  })
})
