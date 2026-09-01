import { DAY_LABELS, type TimetableSlotRow } from '@/lib/timetable/timetableUtils'

const WEEK_ORDER = [1, 2, 3, 4, 5] // 3 (Wednesday) renders the fixed match-day card

type Props = { slots: TimetableSlotRow[] }

export function TimetableGrid({ slots }: Props) {
  return (
    <div className="space-y-4">
      {WEEK_ORDER.map(day => {
        if (day === 3) {
          return (
            <div key="wed" className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-tranmere-blue">Wednesday</p>
              <p className="text-sm text-muted-foreground mt-1">⚽ Match day — no timetable</p>
            </div>
          )
        }

        const daySlots = slots
          .filter(s => s.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))

        return (
          <div key={day} className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
            <p className="text-sm font-semibold text-tranmere-blue">{DAY_LABELS[day]}</p>
            {daySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
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
