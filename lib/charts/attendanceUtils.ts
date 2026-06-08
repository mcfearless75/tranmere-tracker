export type AttendanceDay = {
  attendance_date: string
}

export type ScheduledDay = {
  scheduled_date: string
}

export type AttendanceWeek = {
  week: string    // "DD Mon" label of the Monday
  attended: number
  scheduled: number
  pct: number
}

function getMondayKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  return monday.toISOString().split('T')[0]
}

function formatLabel(mondayKey: string): string {
  const d = new Date(mondayKey + 'T00:00:00Z')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mon = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${dd} ${mon}`
}

export type AttendanceDrillDay = {
  date: string        // YYYY-MM-DD
  label: string       // "Mon 08 Jan"
  attended: boolean
}

export function buildAttendanceDrillDown(
  attendedDays: AttendanceDay[],
  scheduledDays: ScheduledDay[],
): Record<string, AttendanceDrillDay[]> {
  const attendedSet = new Set(attendedDays.map(a => a.attendance_date))
  const weekMap = new Map<string, ScheduledDay[]>()

  for (const s of scheduledDays) {
    const key = getMondayKey(s.scheduled_date)
    if (!weekMap.has(key)) weekMap.set(key, [])
    weekMap.get(key)!.push(s)
  }

  const result: Record<string, AttendanceDrillDay[]> = {}
  for (const [mondayKey, days] of weekMap) {
    const label = formatLabel(mondayKey)
    result[label] = days
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
      .map(d => {
        const dt = new Date(d.scheduled_date + 'T00:00:00Z')
        return {
          date: d.scheduled_date,
          label: dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }),
          attended: attendedSet.has(d.scheduled_date),
        }
      })
  }
  return result
}

export function buildAttendanceWeeks(
  attendedDays: AttendanceDay[],
  scheduledDays: ScheduledDay[],
): AttendanceWeek[] {
  if (scheduledDays.length === 0) return []

  // Group scheduled dates by their Monday key
  const weekScheduled = new Map<string, Set<string>>()
  for (const s of scheduledDays) {
    const key = getMondayKey(s.scheduled_date)
    if (!weekScheduled.has(key)) weekScheduled.set(key, new Set())
    weekScheduled.get(key)!.add(s.scheduled_date)
  }

  const attendedSet = new Set(attendedDays.map(a => a.attendance_date))

  // Sort weeks chronologically then build output
  const sortedKeys = Array.from(weekScheduled.keys()).sort()
  return sortedKeys.map(mondayKey => {
    const scheduledSet = weekScheduled.get(mondayKey)!
    const scheduled = scheduledSet.size
    let attended = 0
    for (const date of scheduledSet) {
      if (attendedSet.has(date)) attended++
    }
    return {
      week: formatLabel(mondayKey),
      attended,
      scheduled,
      pct: Math.round(attended / scheduled * 100),
    }
  })
}
