import {
  calcUnitProgress,
  calcGradeBreakdown,
  overallCompletionPct,
} from '@/lib/academics/academicsUtils'

// ---------------------------------------------------------------------------
// calcUnitProgress
// ---------------------------------------------------------------------------

describe('calcUnitProgress', () => {
  it('returns empty array for no assignments', () => {
    expect(calcUnitProgress([])).toEqual([])
  })

  it('counts submitted and graded as submitted', () => {
    const result = calcUnitProgress([
      { unit_title: 'Unit 1', status: 'submitted' },
      { unit_title: 'Unit 1', status: 'graded' },
      { unit_title: 'Unit 1', status: 'not_started' },
    ])
    expect(result[0].submitted).toBe(2)
    expect(result[0].total).toBe(3)
  })

  it('calculates pct correctly', () => {
    const result = calcUnitProgress([
      { unit_title: 'Unit A', status: 'submitted' },
      { unit_title: 'Unit A', status: 'not_started' },
    ])
    expect(result[0].pct).toBe(50)
  })

  it('pct is 100 when all submitted', () => {
    const result = calcUnitProgress([
      { unit_title: 'Unit X', status: 'submitted' },
      { unit_title: 'Unit X', status: 'graded' },
    ])
    expect(result[0].pct).toBe(100)
  })

  it('pct is 0 when none submitted', () => {
    const result = calcUnitProgress([
      { unit_title: 'Unit Z', status: 'not_started' },
      { unit_title: 'Unit Z', status: 'in_progress' },
    ])
    expect(result[0].pct).toBe(0)
  })

  it('groups by unit_title correctly with multiple units', () => {
    const result = calcUnitProgress([
      { unit_title: 'Unit A', status: 'submitted' },
      { unit_title: 'Unit B', status: 'not_started' },
      { unit_title: 'Unit A', status: 'not_started' },
    ])
    expect(result).toHaveLength(2)
    const unitA = result.find(u => u.unitTitle === 'Unit A')
    const unitB = result.find(u => u.unitTitle === 'Unit B')
    expect(unitA?.submitted).toBe(1)
    expect(unitA?.total).toBe(2)
    expect(unitB?.submitted).toBe(0)
    expect(unitB?.total).toBe(1)
  })

  it('sorts by pct descending', () => {
    const result = calcUnitProgress([
      { unit_title: 'Unit Low', status: 'not_started' },
      { unit_title: 'Unit High', status: 'submitted' },
    ])
    expect(result[0].unitTitle).toBe('Unit High')
    expect(result[1].unitTitle).toBe('Unit Low')
  })
})

// ---------------------------------------------------------------------------
// calcGradeBreakdown
// ---------------------------------------------------------------------------

describe('calcGradeBreakdown', () => {
  it('returns all zeros for empty array', () => {
    expect(calcGradeBreakdown([])).toEqual({
      pass: 0,
      merit: 0,
      distinction: 0,
      notSubmitted: 0,
    })
  })

  it('counts pass, merit, distinction case-insensitively', () => {
    const result = calcGradeBreakdown([
      { grade: 'Pass', status: 'graded' },
      { grade: 'MERIT', status: 'graded' },
      { grade: 'Distinction', status: 'graded' },
    ])
    expect(result.pass).toBe(1)
    expect(result.merit).toBe(1)
    expect(result.distinction).toBe(1)
    expect(result.notSubmitted).toBe(0)
  })

  it('counts not-submitted statuses as notSubmitted', () => {
    const result = calcGradeBreakdown([
      { grade: null, status: 'not_started' },
      { grade: null, status: 'in_progress' },
    ])
    expect(result.notSubmitted).toBe(2)
  })

  it('submitted with no recognised grade counts as notSubmitted', () => {
    const result = calcGradeBreakdown([
      { grade: null, status: 'submitted' },
      { grade: '', status: 'graded' },
    ])
    expect(result.notSubmitted).toBe(2)
    expect(result.pass).toBe(0)
  })

  it('mixed set totals correctly', () => {
    const result = calcGradeBreakdown([
      { grade: 'Pass', status: 'graded' },
      { grade: 'Pass', status: 'graded' },
      { grade: 'Merit', status: 'graded' },
      { grade: null, status: 'not_started' },
    ])
    expect(result.pass).toBe(2)
    expect(result.merit).toBe(1)
    expect(result.distinction).toBe(0)
    expect(result.notSubmitted).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// overallCompletionPct
// ---------------------------------------------------------------------------

describe('overallCompletionPct', () => {
  it('returns 0 for empty units array', () => {
    expect(overallCompletionPct([])).toBe(0)
  })

  it('returns pct for single unit', () => {
    const units = calcUnitProgress([
      { unit_title: 'Unit A', status: 'submitted' },
      { unit_title: 'Unit A', status: 'not_started' },
    ])
    expect(overallCompletionPct(units)).toBe(50)
  })

  it('averages pct across multiple units and rounds', () => {
    const units = [
      { unitTitle: 'A', submitted: 1, total: 2, pct: 50 },
      { unitTitle: 'B', submitted: 2, total: 2, pct: 100 },
    ]
    expect(overallCompletionPct(units)).toBe(75)
  })

  it('returns 100 when all units fully submitted', () => {
    const units = calcUnitProgress([
      { unit_title: 'Unit A', status: 'submitted' },
      { unit_title: 'Unit B', status: 'graded' },
    ])
    expect(overallCompletionPct(units)).toBe(100)
  })
})
