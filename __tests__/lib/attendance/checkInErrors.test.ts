import { friendlyCheckInError } from '@/lib/attendance/checkInErrors'

describe('friendlyCheckInError', () => {
  it('maps an invalid token to a friendly 403', () => {
    const r = friendlyCheckInError('Invalid check-in token')
    expect(r.status).toBe(403)
    expect(r.message).toContain('sticker')
    expect(r.message).not.toContain('token') // no Postgres jargon
  })

  it('maps the morning window error to a friendly 422 with times', () => {
    const r = friendlyCheckInError('Outside morning check-in window (07:30:00 – 11:00:00)')
    expect(r.status).toBe(422)
    expect(r.message).toContain('Morning')
    expect(r.message).toContain('07:30')
    expect(r.message).toContain('11:00')
    expect(r.message).not.toContain(':00:00') // seconds stripped
  })

  it('maps the lunch window error to a friendly 422', () => {
    const r = friendlyCheckInError('Outside lunch check-in window (11:00:00 – 14:30:00)')
    expect(r.status).toBe(422)
    expect(r.message).toContain('Lunch')
    expect(r.message).toContain('11:00')
    expect(r.message).toContain('14:30')
  })

  it('maps the afternoon window error to a friendly 422', () => {
    const r = friendlyCheckInError('Outside afternoon check-in window (14:30:00 – 17:30:00)')
    expect(r.status).toBe(422)
    expect(r.message).toContain('Afternoon')
  })

  it('still returns a friendly 422 when window times cannot be parsed', () => {
    const r = friendlyCheckInError('Outside morning check-in window (weird format)')
    expect(r.status).toBe(422)
    expect(r.message.toLowerCase()).toContain('check-in')
  })

  it('maps Not authenticated to 401', () => {
    const r = friendlyCheckInError('Not authenticated')
    expect(r.status).toBe(401)
  })

  it('maps Invalid phase to 400', () => {
    const r = friendlyCheckInError('Invalid phase: brunch')
    expect(r.status).toBe(400)
  })

  it('falls back to a generic 400 for unknown Postgres errors', () => {
    const r = friendlyCheckInError('duplicate key value violates unique constraint "daily_attendance_pkey"')
    expect(r.status).toBe(400)
    expect(r.message).not.toContain('constraint')
    expect(r.message).not.toContain('duplicate key')
  })

  it('handles null and undefined raw messages', () => {
    expect(friendlyCheckInError(null).status).toBe(400)
    expect(friendlyCheckInError(undefined).status).toBe(400)
  })
})
