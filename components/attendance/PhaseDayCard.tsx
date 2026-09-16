'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, MapPin } from 'lucide-react'
import { PHASE_LABELS, type AttendancePhase, type PhaseWindows } from '@/lib/attendance/phase'
import { buildStudentDayStatus, describeCardState, dayDots, type Phase } from '@/lib/attendance/dayStatus'
import { InAppCheckIn } from '@/app/(student)/attendance/InAppCheckIn'

export type PhaseDayCardExcusal = { phases: string[] } | null

export type PhaseDayCardDaily = {
  am_checked_at: string | null
  lunch_checked_at: string | null
  pm_checked_at: string | null
} | null

type Props = {
  windows: PhaseWindows
  daily: PhaseDayCardDaily
  excusal: PhaseDayCardExcusal
  /**
   * The instant to decide window-open state against — always computed
   * SERVER-SIDE (`new Date()` in the page component) and passed down, never
   * the device clock. A phone set to another timezone, or simply wrong,
   * must not disagree with the academy clock about which window is open.
   */
  now: Date
}

const CHIP_LABEL: Record<Phase, string> = { am: 'AM', lunch: 'Lunch', pm: 'PM' }

function fmtTime(t: string) {
  return t.slice(0, 5)
}

const EXPLAINER_SEEN_KEY = 'attendance_geo_explainer_seen'

function readExplainerSeen(): boolean {
  try {
    return sessionStorage.getItem(EXPLAINER_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markExplainerSeen() {
  try {
    sessionStorage.setItem(EXPLAINER_SEEN_KEY, '1')
  } catch {
    // best-effort only — a blocked/full sessionStorage just means we ask again next render
  }
}

/** Best-effort current geolocation permission state. iOS Safari doesn't support the Permissions API for geolocation, so 'unknown' is a normal, common result there — treated the same as 'prompt'. */
async function checkGeoPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

function GeoExplainer({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="rounded-2xl border border-tranmere-blue/20 bg-tranmere-blue/5 p-4 space-y-2.5 text-left">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-tranmere-blue shrink-0" />
        <p className="text-sm font-semibold text-tranmere-blue">We&apos;ll ask for your location</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        The academy uses your location so check-in only works on campus. It&apos;s only checked at the moment you tap — not tracked afterwards.
      </p>
      <button
        onClick={onContinue}
        className="w-full bg-tranmere-blue text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
      >
        Continue
      </button>
    </div>
  )
}

function LocationDeniedSteps() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left space-y-2">
      <p className="text-sm font-semibold text-amber-900">Location is off for this site</p>
      <p className="text-xs text-amber-900/90">Turn it on before you check in, or your tap gets flagged for a coach to review:</p>
      <ul className="text-xs text-amber-900/90 list-disc pl-4 space-y-1">
        <li><span className="font-medium">iPhone (Safari):</span> tap <span className="font-mono">AA</span> in the address bar → Website Settings → Location → Allow.</li>
        <li><span className="font-medium">Android (Chrome):</span> tap the lock icon → Permissions → Location → Allow.</li>
      </ul>
    </div>
  )
}

/**
 * Tri-phase (AM / lunch / PM) attendance status + check-in CTA — the one
 * design used on both the student dashboard and the attendance page.
 * Data comes in via props from a server parent; this component only owns
 * local UI state (the in-session location explainer) and the check-in
 * mechanics themselves (delegated to InAppCheckIn).
 */
export function PhaseDayCard({ windows, daily, excusal, now }: Props) {
  const [checkedAt, setCheckedAt] = useState<Record<Phase, string | null>>({
    am: daily?.am_checked_at ?? null,
    lunch: daily?.lunch_checked_at ?? null,
    pm: daily?.pm_checked_at ?? null,
  })
  // 'checking' gates rendering InAppCheckIn — it prewarms getGeoFix() on
  // mount, which fires the real browser permission prompt immediately, so it
  // must never mount before we know whether the explainer should show first.
  const [geoStep, setGeoStep] = useState<'checking' | 'explainer' | 'ready'>('checking')
  const [geoDenied, setGeoDenied] = useState(false)

  const excusedPhases = (excusal?.phases ?? []) as Phase[]
  const status = buildStudentDayStatus(
    'self',
    {
      am: { checkedAt: checkedAt.am, isFlagged: false, flagReason: null },
      lunch: { checkedAt: checkedAt.lunch, isFlagged: false, flagReason: null },
      pm: { checkedAt: checkedAt.pm, isFlagged: false, flagReason: null },
    },
    windows,
    now,
    excusedPhases,
  )
  const prompt = describeCardState(status, windows, now)
  const filled = new Set(dayDots(status))

  useEffect(() => {
    if (prompt.kind !== 'cta') return
    let cancelled = false
    checkGeoPermission().then(state => {
      if (cancelled) return
      setGeoDenied(state === 'denied')
      const needsExplainer = (state === 'prompt' || state === 'unknown') && !readExplainerSeen()
      setGeoStep(needsExplainer ? 'explainer' : 'ready')
    })
    return () => { cancelled = true }
    // Re-check only when the CTA phase changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.kind === 'cta' ? prompt.phase : null])

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Today</p>
        <p className="text-xs text-muted-foreground">
          {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}
        </p>
      </div>

      {/* Three equal segments */}
      <div className="flex gap-1.5">
        {(['am', 'lunch', 'pm'] as const).map(phase => (
          <div key={phase} className="flex-1 space-y-1 text-center">
            <div
              aria-label={`${CHIP_LABEL[phase]} ${filled.has(phase) ? 'done' : 'not done'}`}
              className={`h-1.5 rounded-full ${filled.has(phase) ? 'bg-tranmere-blue' : 'bg-gray-200'}`}
            />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{CHIP_LABEL[phase]}</p>
          </div>
        ))}
      </div>

      {prompt.kind === 'weekend' && (
        <p className="text-sm text-muted-foreground">No check-in today.</p>
      )}

      {prompt.kind === 'done' && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
          <CheckCircle2 size={16} /> Done for today
        </p>
      )}

      {prompt.kind === 'closed' && (
        <p className="text-sm text-muted-foreground">Check-in closed for today.</p>
      )}

      {prompt.kind === 'upcoming' && (
        <p className="text-sm text-muted-foreground">
          {PHASE_LABELS[prompt.phase]} opens at {fmtTime(windows[prompt.phase].start)}
        </p>
      )}

      {prompt.kind === 'cta' && (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-tranmere-blue">
            {PHASE_LABELS[prompt.phase]} still needed
          </p>
          <p className="text-xs text-muted-foreground">
            Window {fmtTime(windows[prompt.phase].start)}–{fmtTime(windows[prompt.phase].end)}
          </p>
          {geoDenied && <LocationDeniedSteps />}
          {geoStep === 'explainer' && (
            <GeoExplainer onContinue={() => { markExplainerSeen(); setGeoStep('ready') }} />
          )}
          {geoStep === 'ready' && (
            <InAppCheckIn
              phase={prompt.phase as AttendancePhase}
              onSuccess={ts => setCheckedAt(prev => ({ ...prev, [prompt.phase]: ts }))}
            />
          )}
        </div>
      )}
    </div>
  )
}
