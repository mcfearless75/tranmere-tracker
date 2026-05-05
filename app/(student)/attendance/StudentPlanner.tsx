'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react'

export type PlannerSession = {
  id: string
  session_label: string
  session_type: string
  opens_at: string
  closes_at: string | null
  pin_expires_at: string
}

export type PlannerRecord = {
  session_id: string
  checked_in_at: string
}

type Status = 'checked_in' | 'open' | 'upcoming' | 'missed'

type Props = {
  sessions: PlannerSession[]
  myRecords: PlannerRecord[]
  today: string
}

const TYPE_CHIP: Record<string, string> = {
  training:  'bg-blue-100 text-blue-700',
  match:     'bg-green-100 text-green-700',
  classroom: 'bg-purple-100 text-purple-700',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function deriveStatus(s: PlannerSession, record: PlannerRecord | undefined, now: Date): Status {
  if (record) return 'checked_in'
  const opens  = new Date(s.opens_at)
  const closes = s.closes_at ? new Date(s.closes_at) : null
  if (closes && closes <= now) return 'missed'
  if (opens  <= now)            return 'open'
  return 'upcoming'
}

export function StudentPlanner({ sessions, myRecords, today }: Props) {
  const router = useRouter()
  const now    = new Date()

  const recordMap = new Map(myRecords.map(r => [r.session_id, r]))

  const dayLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="space-y-5 max-w-md mx-auto pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <CalendarDays size={22} className="text-tranmere-blue shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-tranmere-blue leading-tight">Today&apos;s Schedule</h1>
          <p className="text-xs text-muted-foreground">{dayLabel}</p>
        </div>
        {sessions.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-tranmere-blue bg-tranmere-blue/10 px-2.5 py-1 rounded-full">
            {myRecords.length}/{sessions.length} done
          </span>
        )}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="text-center py-14 text-muted-foreground space-y-2">
          <p className="text-4xl">🏖️</p>
          <p className="font-semibold">No sessions today</p>
          <p className="text-sm">Enjoy your day off</p>
        </div>
      )}

      {/* Session cards */}
      <div className="space-y-3">
        {sessions.map(session => {
          const record = recordMap.get(session.id)
          const status = deriveStatus(session, record, now)

          const cardCls =
            status === 'open'       ? 'border-tranmere-blue bg-tranmere-blue/5' :
            status === 'checked_in' ? 'border-green-200 bg-green-50/60' :
            status === 'missed'     ? 'border-red-200 bg-red-50/50 opacity-70' :
                                      'border-border bg-white'

          return (
            <div key={session.id} className={`rounded-2xl border p-4 space-y-3 ${cardCls}`}>
              <div className="flex items-start gap-3">

                {/* Status icon */}
                <div className="shrink-0 mt-0.5">
                  {status === 'checked_in' && <CheckCircle2 size={18} className="text-green-500" />}
                  {status === 'open'       && <div className="w-[18px] h-[18px] rounded-full bg-tranmere-blue animate-pulse" />}
                  {status === 'upcoming'   && <Clock size={18} className="text-muted-foreground" />}
                  {status === 'missed'     && <AlertCircle size={18} className="text-red-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Type + live badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${TYPE_CHIP[session.session_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {session.session_type}
                    </span>
                    {status === 'open' && (
                      <span className="text-[11px] font-bold text-tranmere-blue uppercase tracking-wide animate-pulse">
                        Open now
                      </span>
                    )}
                    {status === 'missed' && (
                      <span className="text-[11px] font-bold text-red-500 uppercase tracking-wide">
                        Missed
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-sm mt-1 leading-tight">{session.session_label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmt(session.opens_at)}
                    {session.closes_at && ` – ${fmt(session.closes_at)}`}
                  </p>

                  {status === 'checked_in' && record && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ✓ Checked in at {new Date(record.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>

              {/* CTA for open sessions */}
              {status === 'open' && (
                <button
                  onClick={() => router.push(`/attendance?session=${session.id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-tranmere-blue text-white font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
                >
                  Check In <ChevronRight size={16} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Manual fallback */}
      <div className="text-center pt-2">
        <button
          onClick={() => router.push('/attendance?manual=1')}
          className="text-xs text-muted-foreground underline"
        >
          Enter PIN manually
        </button>
      </div>
    </div>
  )
}
