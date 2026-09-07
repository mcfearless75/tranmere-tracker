import { DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

const WEEK_ORDER = [1, 2, 3, 4, 5]

type Props = { slots: TimetableSlotRow[] }

export function TimetableGrid({ slots }: Props) {
  return (
    <div className="space-y-4">
      {WEEK_ORDER.map(day => {
        const daySlots = slots
          .filter(s => s.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))

        // Wednesday is match day, but can still carry a real slot (e.g. a
        // session before travel/kick-off) — show the badge either way.
        const isMatchDay = day === 3

        return (
          <div key={day} className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-tranmere-blue">{DAY_LABELS[day]}</p>
              {isMatchDay && (
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  ⚽ Match day
                </span>
              )}
            </div>
            {daySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isMatchDay ? 'No timetable — match day.' : 'Nothing scheduled.'}
              </p>
            ) : (
              daySlots.map(slot => (
                <div key={slot.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <p className="font-medium">{slot.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[
                      `${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
                      slot.location,
                      slot.tutor,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
