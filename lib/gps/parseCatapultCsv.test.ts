import { excelSerialToISO, isCatapultCsv, normalizeCatapultCode, parseCatapultCsv } from './parseCatapultCsv'

describe('parseCatapultCsv', () => {
  it('detects a Catapult One header', () => {
    const header = 'Date,Session Title,Player Name,Split Name,Tags,Duration,Distance (metres),Sprint Distance (m)'
    expect(isCatapultCsv(header)).toBe(true)
    expect(isCatapultCsv('Name,Date,Total Distance (m)')).toBe(false)
  })

  it('converts the Oldham Excel serial to 16 Sep 2026', () => {
    expect(excelSerialToISO(46281)).toBe('2026-09-16')
  })

  it('normalises Tranmere P27 codes', () => {
    expect(normalizeCatapultCode('Tranmere P27')).toEqual(
      expect.arrayContaining(['tranmere p27', 'p27'])
    )
  })

  it('keeps Full Match rows and drops zeros / all-window rows', () => {
    const csv = [
      'Date,Session Title,Player Name,Split Name,Duration,Distance (metres),Sprint Distance (m),Player Load,Top Speed (m/s),Distance in Speed Zone 4  (metres),Distance in Speed Zone 5  (metres),Accelerations Zone Count: 2 - 3 m/s/s,Accelerations Zone Count: 3 - 4 m/s/s,Accelerations Zone Count: > 4 m/s/s,Deceleration Zone Count: 2 - 3 m/s/s,Deceleration Zone Count: 3 - 4 m/s/s,Deceleration Zone Count: > 4 m/s/s',
      '46281,TR Prem vs Oldham (A),Tranmere P27,all,25268,8844.292,570.775,382.6834,8.1245,455.3965,115.3787,156,58,25,133,52,20',
      '46281,TR Prem vs Oldham (A),Tranmere P27,Full Match,6088,7040.769,533.118,296.5646,8.1245,417.7393,115.3787,139,55,24,124,49,20',
      '46281,TR Prem vs Oldham (A),Tranmere P24,Full Match,0,0,0,0,0,0,0,0,0,0,0,0,0',
    ].join('\n')

    const rows = parseCatapultCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].playerName).toBe('Tranmere P27')
    expect(rows[0].sessionDate).toBe('2026-09-16')
    expect(rows[0].total_distance_m).toBeCloseTo(7040.769)
    expect(rows[0].max_speed_kmh).toBeCloseTo(29.2)
    expect(rows[0].duration_mins).toBeCloseTo(101.5)
    expect(rows[0].hsr_distance_m).toBeCloseTo(533.118)
  })
}