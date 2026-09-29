/**
 * Day dividers for the chat thread. Bubbles only show HH:MM, so without a
 * divider a message from last Tuesday reads the same as one from this
 * morning. All calendar maths is done in Europe/London, matching the bubble
 * time format in MessageBubble.
 */

const TZ = 'Europe/London'

/** YYYY-MM-DD of an instant, as a London calendar date. */
export function londonDayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** Whole calendar days between two London day keys (b - a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** "Today", "Yesterday", "Tuesday", "Tue 12 Aug", or "12 Aug 2025". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const key = londonDayKey(iso)
  const diff = dayDiff(key, londonDayKey(now))
  const d = new Date(iso)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long' })
  if (key.slice(0, 4) === londonDayKey(now).slice(0, 4)) {
    return d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
  }
  return d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
}

/** True when a divider belongs above `current` (first message, or a new London day). */
export function needsDayDivider(prevIso: string | undefined, currentIso: string): boolean {
  return !prevIso || londonDayKey(prevIso) !== londonDayKey(currentIso)
}

/** HH:MM in London time. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}
