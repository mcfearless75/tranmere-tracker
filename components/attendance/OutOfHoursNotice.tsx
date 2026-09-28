import { Clock } from 'lucide-react'
import type { AttendancePhase, PhaseWindows } from '@/lib/attendance/phase'

const hhmm = (s: string) => s.substring(0, 5)

const COPY: Record<AttendancePhase, { title: string; opens: string }> = {
  am:    { title: 'Too early to check in',  opens: 'Morning check-in opens at' },
  lunch: { title: 'Too early for lunch',    opens: 'Lunch check-in opens at' },
  pm:    { title: 'Too early to scan out',  opens: 'Scan-out opens at' },
}

/**
 * Sticker tapped while no window is open. In practice this is almost always
 * the lunch-to-pm gap (13:30-14:30): before 2026-09-28 it showed a bare
 * "Out of hours", which read as broken to a student trying to scan out.
 */
export function OutOfHoursNotice({ next, windows }: { next: AttendancePhase | null; windows: PhaseWindows }) {
  return (
    <div data-testid="out-of-hours" className="flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center px-4">
      <Clock size={56} className="text-tranmere-blue" />
      {next ? (
        <>
          <h1 className="text-xl font-bold text-tranmere-blue">{COPY[next].title}</h1>
          <p className="text-lg font-semibold">
            {COPY[next].opens} {hhmm(windows[next].start)}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nothing&apos;s been recorded yet. Tap the sticker again then
            {next === 'pm' ? ' to keep your 🔥 streak going.' : '.'}
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-tranmere-blue">Check-in&apos;s closed for today</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Scan-out closed at {hhmm(windows.pm.end)}. See you tomorrow. Morning check-in opens at {hhmm(windows.am.start)}.
          </p>
        </>
      )}
    </div>
  )
}
