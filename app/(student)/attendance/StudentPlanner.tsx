'use client'

import { CalendarDays, CheckCircle2, Clock, Sun, Moon, Smartphone } from 'lucide-react'

export type PlannerSession = {
  id: string
  session_label: string
  session_type: string
  opens_at: string
  closes_at: string | null
}

export type DailyAttendance = {
  am_checked_at: string | null
  pm_checked_at: string | null
} | null

type Props = {
  sessions:       PlannerSession[]
  daily:          DailyAttendance
  today:          string
  amWindow:       { start: string; end: string }   // 'HH:MM:SS'
  pmWindow:       { start: string; end: string }
}

const TYPE_CHIP: Record<string, string> = {
  training:  'bg-blue-100 text-blue-700',
  match:     'bg-green-100 text-green-700',
  classroom: 'bg-purple-100 text-purple-700',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtTime(t: string) {
  return t.substring(0, 5)
}
function inWindow(now: Date, startHHMMSS: string, endHHMMSS: string) {
  const [sH, sM] = startHHMMSS.split(':').map(Number)
  const [eH, eM] = endHHMMSS.split(':').map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  return mins >= sH * 60 + sM && mins <= eH * 60 + eM
}

function PhaseCard({
  phase, checkedAt, window, now,
}: {
  phase: 'am' | 'pm'
  checkedAt: string | null
  window: { start: string; end: string }
  now: Date
}) {
  const isOpen = inWindow(now, window.start, window.end)
  const Icon   = phase === 'am' ? Sun : Moon
  const title  = phase === 'am' ? 'Morning' : 'End of day'

  if (checkedAt) {
    return (
      <div className="flex-1 rounded-2xl border border-green-200 bg-green-50/60 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-600" />
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">{title}</p>
        </div>
        <p className="text-sm font-bold text-green-800">Checked in</p>
        <p className="text-[11px] text-green-700/80">at {fmt(checkedAt)}</p>
      </div>
    )
  }

  return (
    <div className={`flex-1 rounded-2xl border p-4 space-y-1 ${isOpen ? 'border-tranmere-blue bg-tranmere-blue/5' : 'border-border bg-white'}`}>
      <div className="flex items-center gap-2">
        <Icon size={18} className={isOpen ? 'text-tranmere-blue' : 'text-muted-foreground'} />
        <p className={`text-xs font-semibold uppercase tracking-wide ${isOpen ? 'text-tranmere-blue' : 'text-muted-foreground'}`}>
          {title}
        </p>
      </div>
      <p className={`text-sm font-bold ${isOpen ? 'text-tranmere-blue' : 'text-muted-foreground'}`}>
        {isOpen ? 'Tap NFC sticker' : 'Not yet'}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Window: {fmtTime(window.start)}–{fmtTime(window.end)}
      </p>
    </div>
  )
}

export function StudentPlanner({ sessions, daily, today, amWindow, pmWindow }: Props) {
  const now = new Date()

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

      {/* AM / PM check-in cards */}
      <div className="flex gap-3">
        <PhaseCard phase="am" checkedAt={daily?.am_checked_at ?? null} window={amWindow} now={now} />
        <PhaseCard phase="pm" checkedAt={daily?.pm_checked_at ?? null} window={pmWindow} now={now} />
      </div>

      {/* NFC hint */}
      <div className="flex items-start gap-2.5 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2.5">
        <Smartphone size={16} className="text-tranmere-blue shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900/80 leading-relaxed">
          Tap your phone on the Tranmere NFC sticker at reception when you arrive and again before you leave. No PIN needed.
        </p>
      </div>

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
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${TYPE_CHIP[session.session_type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {session.session_type}
                      </span>
                      {isLive && <span className="text-[10px] font-bold text-tranmere-blue uppercase tracking-wide">Live</span>}
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
