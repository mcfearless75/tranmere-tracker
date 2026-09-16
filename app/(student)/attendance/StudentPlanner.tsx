'use client'

import { CalendarDays, CalendarOff, CheckCircle2, Clock } from 'lucide-react'
import type { PhaseWindows } from '@/lib/attendance/phase'
import { EXCUSAL_LABELS, type ExcusalReason } from '@/lib/attendance/excusal'
import { PhaseDayCard } from '@/components/attendance/PhaseDayCard'

export type PlannerSession = {
  id: string
  session_label: string
  session_type: string
  opens_at: string
  closes_at: string | null
}

export type DailyAttendance = {
  am_checked_at: string | null
  lunch_checked_at: string | null
  pm_checked_at: string | null
} | null

export type PlannerExcusal = {
  reason: ExcusalReason
  note: string | null
  phases: string[]
} | null

type Props = {
  sessions: PlannerSession[]
  daily:    DailyAttendance
  today:    string
  windows:  PhaseWindows
  /**
   * The instant to decide window-open state against, computed SERVER-SIDE
   * (Europe/London) and passed down to PhaseDayCard. The device clock is
   * never consulted — a phone set to another timezone must not disagree
   * with the academy clock about window state.
   */
  now: Date
  /** Today's excusal for this student, if staff have logged one. Null when none. */
  excusal: PlannerExcusal
}

const TYPE_CHIP: Record<string, string> = {
  training:  'bg-blue-100 text-blue-700',
  match:     'bg-green-100 text-green-700',
  classroom: 'bg-purple-100 text-purple-700',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

export function StudentPlanner({ sessions, daily, today, windows, now, excusal }: Props) {
  const dayLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="space-y-5 max-w-md mx-auto pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <CalendarDays size={22} className="text-tranmere-blue shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-tranmere-blue leading-tight">Today&apos;s Plan</h1>
          <p className="text-xs text-muted-foreground">{dayLabel}</p>
        </div>
      </div>

      {/* Excusal banner — reassuring, not alarming: staff already know and logged it */}
      {excusal && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 flex items-start gap-3">
          <CalendarOff size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-blue-800">
              You&apos;re marked off today — {EXCUSAL_LABELS[excusal.reason]}
            </p>
            {excusal.note && (
              <p className="text-xs text-blue-700/80">{excusal.note}</p>
            )}
          </div>
        </div>
      )}

      {/* Tri-phase status + check-in — the same component used on the dashboard */}
      <PhaseDayCard windows={windows} daily={daily} excusal={excusal} now={now} />

      {/* Today's lessons */}
      {sessions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Today&apos;s Sessions
          </h2>
          <div className="space-y-2">
            {sessions.map(session => {
              const opens   = new Date(session.opens_at)
              const closes  = session.closes_at ? new Date(session.closes_at) : null
              const isPast  = closes && closes <= now
              const isLive  = opens <= now && (!closes || closes > now)
              return (
                <div key={session.id} className={`rounded-xl border p-3 flex items-start gap-3 ${
                  isLive ? 'border-tranmere-blue bg-tranmere-blue/5'
                  : isPast ? 'border-border bg-gray-50/60 opacity-70'
                  : 'border-border bg-white'
                }`}>
                  <div className="shrink-0 mt-0.5">
                    {isPast ? <CheckCircle2 size={16} className="text-muted-foreground" />
                    : isLive ? <div className="w-[16px] h-[16px] rounded-full bg-tranmere-blue animate-pulse" />
                    : <Clock size={16} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${TYPE_CHIP[session.session_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {session.session_type}
                      </span>
                      {isLive && <span className="text-xs font-bold text-tranmere-blue uppercase tracking-wide">Live</span>}
                    </div>
                    <p className="font-semibold text-sm mt-0.5 leading-tight">{session.session_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(session.opens_at)}{session.closes_at && ` – ${fmt(session.closes_at)}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-10 text-muted-foreground space-y-1">
          <p className="text-3xl">🏖️</p>
          <p className="font-medium">No sessions today</p>
          <p className="text-xs">Day off — enjoy</p>
        </div>
      )}
    </div>
  )
}
