// Date helpers for Europe/London (academy local time).
// Server code runs in UTC on Vercel — never use new Date().toISOString() or
// getHours() when you mean "the date/hour the academy is experiencing".
// Note: new Date(d.toLocaleString('en-GB', ...)) does NOT work — the en-GB
// dd/mm/yyyy string fails to parse, yielding Invalid Date / NaN.

/** ISO date (YYYY-MM-DD) for the given instant in Europe/London. */
export function londonDateISO(date: Date = new Date()): string {
  // en-CA locale formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(date)
}

/** Hour of day (0–23) for the given instant in Europe/London. */
export function londonHour(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date)
  )
}

/** Minutes that Europe/London is ahead of UTC at the given instant (60 in BST, 0 in GMT). */
function londonOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  const wallAsUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((wallAsUTC - at.getTime()) / 60_000)
}

/**
 * Convert a Europe/London wall-clock time on a given date to the true UTC
 * instant. `new Date(year, month, day, h, m)` runs in SERVER-local time
 * (UTC on Vercel), so a 09:00 London slot silently becomes 09:00 UTC
 * (= 10:00 BST). This helper applies the correct BST/GMT offset for that
 * specific date via Intl.
 *
 * @param dateISO 'YYYY-MM-DD' (the London calendar date)
 * @param time    'HH:MM' or 'HH:MM:SS' (London wall clock)
 */
export function londonWallTimeToUTC(dateISO: string, time: string): Date {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const [h, min, sec] = time.split(':').map(Number)
  const wallAsUTC = Date.UTC(y, mo - 1, d, h, min, sec || 0)
  // First guess: interpret the wall time as UTC, read the offset at that
  // instant, correct, then re-check once (handles times near a DST switch —
  // London transitions happen at 01:00 UTC, so one correction converges).
  let offset = londonOffsetMinutes(new Date(wallAsUTC))
  let utc = wallAsUTC - offset * 60_000
  offset = londonOffsetMinutes(new Date(utc))
  utc = wallAsUTC - offset * 60_000
  return new Date(utc)
}
