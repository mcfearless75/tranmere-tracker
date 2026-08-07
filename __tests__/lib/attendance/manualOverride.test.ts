import { buildOverridePatch, isValidOverrideRequest } from '@/lib/attendance/manualOverride'

describe('isValidOverrideRequest', () => {
  const valid = { studentId: 'abc-123', date: '2026-08-10', phase: 'lunch', action: 'mark_present' }

  it('accepts a well-formed request for each phase and action', () => {
    for (const phase of ['am', 'lunch', 'pm']) {
      for (const action of ['mark_present', 'clear']) {
        expect(isValidOverrideRequest({ ...valid, phase, action })).toBe(true)
      }
    }
  })

  it('rejects unknown phases and actions', () => {
    expect(isValidOverrideRequest({ ...valid, phase: 'evening' })).toBe(false)
    expect(isValidOverrideRequest({ ...valid, action: 'delete_row' })).toBe(false)
  })

  it('rejects malformed dates and empty student ids', () => {
    expect(isValidOverrideRequest({ ...valid, date: '10/08/2026' })).toBe(false)
    expect(isValidOverrideRequest({ ...valid, date: 'not-a-date' })).toBe(false)
    expect(isValidOverrideRequest({ ...valid, studentId: '' })).toBe(false)
    expect(isValidOverrideRequest({ ...valid, studentId: undefined })).toBe(false)
  })
})

describe('buildOverridePatch', () => {
  const now = new Date('2026-08-10T08:15:00Z')

  it('mark_present sets checked_at to now and flags the row with the staff name', () => {
    expect(buildOverridePatch('lunch', 'mark_present', 'Paul McCarthy', now)).toEqual({
      lunch_checked_at: '2026-08-10T08:15:00.000Z',
      lunch_is_flagged: true,
      lunch_flag_reason: 'Manual override by Paul McCarthy',
    })
  })

  it('targets the correct columns per phase', () => {
    expect(Object.keys(buildOverridePatch('am', 'mark_present', 'X', now))).toEqual([
      'am_checked_at', 'am_is_flagged', 'am_flag_reason',
    ])
    expect(Object.keys(buildOverridePatch('pm', 'clear', 'X', now))).toEqual([
      'pm_checked_at', 'pm_is_flagged', 'pm_flag_reason',
    ])
  })

  it('clear nulls checked_at and resets the flag', () => {
    expect(buildOverridePatch('am', 'clear', 'Paul McCarthy', now)).toEqual({
      am_checked_at: null,
      am_is_flagged: false,
      am_flag_reason: null,
    })
  })

  it('never touches other phases', () => {
    const patch = buildOverridePatch('lunch', 'mark_present', 'X', now)
    expect(patch).not.toHaveProperty('am_checked_at')
    expect(patch).not.toHaveProperty('pm_checked_at')
  })
})
