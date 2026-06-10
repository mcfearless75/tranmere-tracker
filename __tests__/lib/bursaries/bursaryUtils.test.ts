import {
  generatePaymentSchedule,
  formatAmount,
  paidToDate,
  remainingScheduled,
  nextDueDate,
  scheduleSummary,
  formatDueDate,
  isBursaryPeriod,
  isBursaryStatus,
  isPaymentStatus,
  isISODateString,
} from '@/lib/bursaries/bursaryUtils'

describe('generatePaymentSchedule', () => {
  describe('weekly', () => {
    it('generates 7-day steps from start to end inclusive', () => {
      const schedule = generatePaymentSchedule('2026-01-01', '2026-01-29', 'weekly', 25)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2026-01-01',
        '2026-01-08',
        '2026-01-15',
        '2026-01-22',
        '2026-01-29',
      ])
      expect(schedule.every(p => p.amount === 25)).toBe(true)
    })

    it('excludes a date one day past the end', () => {
      const schedule = generatePaymentSchedule('2026-01-01', '2026-01-28', 'weekly', 25)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2026-01-01',
        '2026-01-08',
        '2026-01-15',
        '2026-01-22',
      ])
    })

    it('generates 53 payments over a 12-month horizon when end date is null', () => {
      const schedule = generatePaymentSchedule('2026-01-01', null, 'weekly', 10)
      expect(schedule).toHaveLength(53)
      expect(schedule[0].due_date).toBe('2026-01-01')
      expect(schedule[schedule.length - 1].due_date).toBe('2026-12-31')
    })
  })

  describe('monthly', () => {
    it('steps by calendar month on the same day', () => {
      const schedule = generatePaymentSchedule('2026-03-15', '2026-06-15', 'monthly', 40)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2026-03-15',
        '2026-04-15',
        '2026-05-15',
        '2026-06-15',
      ])
    })

    it('clamps 31 January to month ends and restores the anchor day', () => {
      const schedule = generatePaymentSchedule('2026-01-31', '2026-04-30', 'monthly', 40)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
      ])
    })

    it('uses 29 February in a leap year', () => {
      const schedule = generatePaymentSchedule('2028-01-31', '2028-02-29', 'monthly', 40)
      expect(schedule.map(p => p.due_date)).toEqual(['2028-01-31', '2028-02-29'])
    })

    it('generates exactly 12 payments when end date is null', () => {
      const schedule = generatePaymentSchedule('2026-03-15', null, 'monthly', 40)
      expect(schedule).toHaveLength(12)
      expect(schedule[0].due_date).toBe('2026-03-15')
      expect(schedule[11].due_date).toBe('2027-02-15')
    })
  })

  describe('termly', () => {
    it('generates 1 Sep, 1 Jan and 1 Apr occurrences within the window', () => {
      const schedule = generatePaymentSchedule('2025-09-01', '2026-04-01', 'termly', 150)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2025-09-01',
        '2026-01-01',
        '2026-04-01',
      ])
    })

    it('skips term dates before the start date', () => {
      const schedule = generatePaymentSchedule('2025-10-15', '2026-09-30', 'termly', 150)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2026-01-01',
        '2026-04-01',
        '2026-09-01',
      ])
    })

    it('covers the 12-month horizon when end date is null', () => {
      const schedule = generatePaymentSchedule('2026-01-01', null, 'termly', 150)
      expect(schedule.map(p => p.due_date)).toEqual([
        '2026-01-01',
        '2026-04-01',
        '2026-09-01',
      ])
    })
  })

  describe('edge cases', () => {
    it('returns an empty schedule when end date is before start date', () => {
      expect(generatePaymentSchedule('2026-02-01', '2026-01-01', 'weekly', 10)).toEqual([])
    })

    it('returns a single payment when start and end are the same day', () => {
      expect(generatePaymentSchedule('2026-02-01', '2026-02-01', 'monthly', 10)).toEqual([
        { due_date: '2026-02-01', amount: 10 },
      ])
    })

    it('returns an empty schedule for a non-positive amount', () => {
      expect(generatePaymentSchedule('2026-01-01', null, 'weekly', 0)).toEqual([])
      expect(generatePaymentSchedule('2026-01-01', null, 'weekly', -5)).toEqual([])
    })

    it('returns an empty schedule for invalid dates', () => {
      expect(generatePaymentSchedule('not-a-date', null, 'weekly', 10)).toEqual([])
      expect(generatePaymentSchedule('2026-02-30', null, 'weekly', 10)).toEqual([])
      expect(generatePaymentSchedule('2026-01-01', '2026-13-01', 'weekly', 10)).toEqual([])
    })

    it('rounds amounts to two decimal places', () => {
      const schedule = generatePaymentSchedule('2026-01-01', '2026-01-01', 'weekly', 33.333)
      expect(schedule[0].amount).toBe(33.33)
    })
  })
})

describe('formatAmount', () => {
  it('formats whole pounds with two decimal places', () => {
    expect(formatAmount(10)).toBe('£10.00')
  })

  it('formats thousands with a separator', () => {
    expect(formatAmount(1234.5)).toBe('£1,234.50')
  })

  it('formats pence-only amounts', () => {
    expect(formatAmount(0.5)).toBe('£0.50')
  })
})

describe('running total helpers', () => {
  const payments = [
    { status: 'paid' as const, amount: 40, due_date: '2026-01-01' },
    { status: 'paid' as const, amount: 40, due_date: '2026-02-01' },
    { status: 'skipped' as const, amount: 40, due_date: '2026-03-01' },
    { status: 'pending' as const, amount: 40, due_date: '2026-04-01' },
    { status: 'pending' as const, amount: 40, due_date: '2026-05-01' },
  ]

  it('paidToDate sums only paid payments', () => {
    expect(paidToDate(payments)).toBe(80)
  })

  it('remainingScheduled sums only pending payments', () => {
    expect(remainingScheduled(payments)).toBe(80)
  })

  it('nextDueDate returns the earliest pending due date', () => {
    expect(nextDueDate(payments)).toBe('2026-04-01')
  })

  it('nextDueDate returns null when nothing is pending', () => {
    expect(nextDueDate([{ status: 'paid', due_date: '2026-01-01' }])).toBeNull()
  })
})

describe('scheduleSummary', () => {
  it('summarises count, per-payment amount and total', () => {
    const schedule = generatePaymentSchedule('2026-03-15', null, 'monthly', 40)
    expect(scheduleSummary(schedule)).toBe('12 payments of £40.00 (£480.00 total)')
  })

  it('uses singular wording for a single payment', () => {
    expect(scheduleSummary([{ due_date: '2026-01-01', amount: 25 }])).toBe(
      '1 payment of £25.00 (£25.00 total)',
    )
  })

  it('handles an empty schedule', () => {
    expect(scheduleSummary([])).toBe('No payments scheduled')
  })
})

describe('formatDueDate', () => {
  it('formats an ISO date in British style', () => {
    expect(formatDueDate('2026-09-01')).toBe('1 Sep 2026')
  })

  it('returns the input unchanged when invalid', () => {
    expect(formatDueDate('nonsense')).toBe('nonsense')
  })
})

describe('type guards', () => {
  it('isBursaryPeriod accepts only valid periods', () => {
    expect(isBursaryPeriod('weekly')).toBe(true)
    expect(isBursaryPeriod('monthly')).toBe(true)
    expect(isBursaryPeriod('termly')).toBe(true)
    expect(isBursaryPeriod('daily')).toBe(false)
    expect(isBursaryPeriod(7)).toBe(false)
  })

  it('isBursaryStatus accepts only valid statuses', () => {
    expect(isBursaryStatus('active')).toBe(true)
    expect(isBursaryStatus('suspended')).toBe(true)
    expect(isBursaryStatus('ended')).toBe(true)
    expect(isBursaryStatus('paused')).toBe(false)
  })

  it('isPaymentStatus accepts only valid statuses', () => {
    expect(isPaymentStatus('pending')).toBe(true)
    expect(isPaymentStatus('paid')).toBe(true)
    expect(isPaymentStatus('skipped')).toBe(true)
    expect(isPaymentStatus('cancelled')).toBe(false)
  })

  it('isISODateString validates format and real calendar dates', () => {
    expect(isISODateString('2026-01-31')).toBe(true)
    expect(isISODateString('2026-02-30')).toBe(false)
    expect(isISODateString('31/01/2026')).toBe(false)
    expect(isISODateString(null)).toBe(false)
  })
})
