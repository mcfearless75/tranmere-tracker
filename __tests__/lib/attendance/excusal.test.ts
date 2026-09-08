import {
  isValidExcuseRequest,
  resolvePhases,
  buildExcusalRow,
  excusalCoversPhase,
  removePhase,
  stripCheckedPhases,
  EXCUSAL_REASONS,
} from '@/lib/attendance/excusal'

describe('isValidExcuseRequest', () => {
  const base = { studentId: 'abc-123', date: '2026-09-08' }

  it('accepts a well-formed excuse request for each reason', () => {
    for (const reason of EXCUSAL_REASONS) {
      expect(isValidExcuseRequest({ ...base, action: 'excuse', reason })).toBe(true)
    }
  })

  it('accepts excuse with optional note and phases', () => {
    expect(isValidExcuseRequest({
      ...base, action: 'excuse', reason: 'appointment', note: 'Back for PM', phases: ['am'],
    })).toBe(true)
  })

  it('rejects excuse with an unknown reason', () => {
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'holiday' })).toBe(false)
  })

  it('rejects excuse with an empty or unknown phases array', () => {
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'ill', phases: [] })).toBe(false)
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'ill', phases: ['evening'] })).toBe(false)
  })

  it('rejects excuse with a non-string note', () => {
    expect(isValidExcuseRequest({ ...base, action: 'excuse', reason: 'ill', note: 123 })).toBe(false)
  })

  it('accepts a clear request with no reason', () => {
    expect(isValidExcuseRequest({ ...base, action: 'clear' })).toBe(true)
  })

  it('accepts a clear_phase request with a valid phase', () => {
    expect(isValidExcuseRequest({ ...base, action: 'clear_phase', phase: 'lunch' })).toBe(true)
  })

  it('rejects a clear_phase request with an invalid phase', () => {
    expect(isValidExcuseRequest({ ...base, action: 'clear_phase', phase: 'evening' })).toBe(false)
  })

  it('rejects an unknown action', () => {
    expect(isValidExcuseRequest({ ...base, action: 'delete_everything' })).toBe(false)
  })

  it('rejects malformed dates and empty student ids', () => {
    expect(isValidExcuseRequest({ studentId: 'x', date: '08/09/2026', action: 'clear' })).toBe(false)
    expect(isValidExcuseRequest({ studentId: '', date: '2026-09-08', action: 'clear' })).toBe(false)
  })
})

describe('resolvePhases', () => {
  it('defaults to the whole day when phases is omitted', () => {
    expect(resolvePhases(undefined)).toEqual(['am', 'lunch', 'pm'])
  })

  it('defaults to the whole day when phases is empty', () => {
    expect(resolvePhases([])).toEqual(['am', 'lunch', 'pm'])
  })

  it('keeps a narrowed phases list as-is', () => {
    expect(resolvePhases(['am'])).toEqual(['am'])
  })
})

describe('buildExcusalRow', () => {
  it('builds a whole-day row when phases is omitted', () => {
    expect(buildExcusalRow('s1', '2026-09-08', 'ill', undefined, undefined, 'staff1')).toEqual({
      student_id: 's1',
      excused_date: '2026-09-08',
      reason: 'ill',
      note: null,
      phases: ['am', 'lunch', 'pm'],
      created_by: 'staff1',
    })
  })

  it('builds a narrowed row with a note', () => {
    expect(buildExcusalRow('s1', '2026-09-08', 'appointment', 'Dentist, back for PM', ['am'], 'staff1')).toEqual({
      student_id: 's1',
      excused_date: '2026-09-08',
      reason: 'appointment',
      note: 'Dentist, back for PM',
      phases: ['am'],
      created_by: 'staff1',
    })
  })
})

describe('excusalCoversPhase', () => {
  it('is true when phases includes the phase', () => {
    expect(excusalCoversPhase({ phases: ['am', 'lunch'] }, 'am')).toBe(true)
  })

  it('is false when phases does not include the phase', () => {
    expect(excusalCoversPhase({ phases: ['am'] }, 'pm')).toBe(false)
  })

  it('is false for null or undefined excusal', () => {
    expect(excusalCoversPhase(null, 'am')).toBe(false)
    expect(excusalCoversPhase(undefined, 'am')).toBe(false)
  })
})

describe('removePhase', () => {
  it('removes the given phase', () => {
    expect(removePhase(['am', 'lunch', 'pm'], 'lunch')).toEqual(['am', 'pm'])
  })

  it('returns an empty array when the last phase is removed', () => {
    expect(removePhase(['pm'], 'pm')).toEqual([])
  })

  it('is a no-op when the phase is not present', () => {
    expect(removePhase(['am'], 'pm')).toEqual(['am'])
  })
})

describe('stripCheckedPhases', () => {
  it('removes phases that already have a real check-in', () => {
    expect(stripCheckedPhases(['am', 'lunch', 'pm'], { am: true, lunch: false, pm: false })).toEqual(['lunch', 'pm'])
  })

  it('is a no-op when nothing is checked in', () => {
    expect(stripCheckedPhases(['am', 'lunch'], { am: false, lunch: false, pm: false })).toEqual(['am', 'lunch'])
  })

  it('can return an empty array when everything requested is already checked in', () => {
    expect(stripCheckedPhases(['am'], { am: true, lunch: false, pm: false })).toEqual([])
  })
})
