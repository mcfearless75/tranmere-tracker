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
