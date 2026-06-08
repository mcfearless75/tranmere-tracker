'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getDaysInMonth, groupEventsByDate, type CalendarEvent } from '@/lib/calendar/calendarUtils'

interface CalendarGridProps {
  events: CalendarEvent[]
  initialYear: number
  initialMonth: number // 1-based
}

const DOT_COLOUR: Record<CalendarEvent['type'], string> = {
  session: 'bg-blue-500',
  match: 'bg-green-500',
  deadline: 'bg-red-500',
}

const EVENT_BADGE: Record<CalendarEvent['type'], string> = {
  session: 'bg-blue-100 text-blue-800 border-blue-200',
  match: 'bg-green-100 text-green-800 border-green-200',
  deadline: 'bg-red-100 text-red-800 border-red-200',
}

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  session: 'Session',
  match: 'Match',
  deadline: 'Deadline',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function CalendarGrid({ events, initialYear, initialMonth }: CalendarGridProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth) // 1-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const grouped = groupEventsByDate(events)

  const daysInMonth = getDaysInMonth(year, month)
  // Day of week for 1st of month: 0=Sun…6=Sat → remap to Mon=0…Sun=6
  const rawFirstDay = new Date(year, month - 1, 1).getDay()
  const firstDayOffset = rawFirstDay === 0 ? 6 : rawFirstDay - 1 // Mon-based

  const today = new Date().toISOString().split('T')[0]

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const selectedEvents = selectedDate ? (grouped[selectedDate] ?? []) : []

  // Build cell array: nulls for leading blanks, then day numbers
  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} className="text-tranmere-blue" />
        </button>
        <h2 className="text-base font-bold text-tranmere-blue">{monthLabel}</h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={18} className="text-tranmere-blue" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} />
          }

          const ymd = toYMD(year, month, day)
          const dayEvents = grouped[ymd] ?? []
          const isToday = ymd === today
          const isSelected = ymd === selectedDate
          const hasSession = dayEvents.some(e => e.type === 'session')
          const hasMatch = dayEvents.some(e => e.type === 'match')
          const hasDeadline = dayEvents.some(e => e.type === 'deadline')

          return (
            <button
              key={ymd}
              onClick={() => setSelectedDate(isSelected ? null : ymd)}
              className={`
                relative flex flex-col items-center py-1.5 rounded-xl transition-colors
                ${isSelected
                  ? 'bg-tranmere-blue text-white shadow-md'
                  : isToday
                  ? 'bg-blue-50 border border-tranmere-blue/30 text-tranmere-blue font-bold'
                  : 'hover:bg-gray-50 active:bg-gray-100 text-gray-700'
                }
              `}
              aria-pressed={isSelected}
              aria-label={`${ymd}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
            >
              <span className={`text-sm font-medium leading-none ${isSelected ? 'text-white' : isToday ? 'text-tranmere-blue' : ''}`}>
                {day}
              </span>
              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {hasSession && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-200' : 'bg-blue-500'}`} />
                  )}
                  {hasMatch && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-green-200' : 'bg-green-500'}`} />
                  )}
                  {hasDeadline && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-red-200' : 'bg-red-500'}`} />
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center pt-1">
        {(Object.entries(DOT_COLOUR) as [CalendarEvent['type'], string][]).map(([type, colour]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${colour}`} />
            <span className="text-xs text-muted-foreground">{TYPE_LABEL[type]}</span>
          </div>
        ))}
      </div>

      {/* Day panel */}
      {selectedDate && (
        <div className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-tranmere-blue">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((event, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${EVENT_BADGE[event.type]}`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLOUR[event.type]}`} />
                  <span className="flex-1 font-medium">{event.label}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    {TYPE_LABEL[event.type]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
