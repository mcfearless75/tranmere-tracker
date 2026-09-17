// lib/dashboard/nextUp.ts
//
// Pure builder for the student dashboard's "Next up" block (Task B —
// tranmere-tracker-journey-next). Deliberately takes already-fetched data
// (today's merged session list, the open-wellbeing-survey flag, the
// student's next fixture) rather than querying anything itself — the page
// already fetches all of this for the "itinerary hero" / "wellbeing
// prompt" / "upcoming matches" sections that move into the collapsed
// "More" disclosure, so this just re-derives a compact summary from the
// same results instead of querying twice.
//
// Kept dependency-free (no Supabase, no React) so the "hide empty rows,
// collapse to one empty-state message" behaviour is unit-testable without
// rendering the page.

export type NextUpSessionInput = {
  session_label: string
  opens_at: string
  closes_at: string | null
}

export type NextUpFixtureInput = {
  opponent: string
  match_date: string
  location?: string | null
}

export type NextUpRow =
  | { kind: 'session'; label: string; timeLabel: string; live: boolean }
  | { kind: 'wellbeing' }
  | { kind: 'fixture'; opponent: string; daysLabel: string; location: string | null }

const LONDON_TIME_FMT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
}

/**
 * Builds at most three rows — one per category — each included only when
 * that category actually has something due. Callers render a single
 * shared empty-state message when this returns an empty array, rather
 * than one "No X" line per category.
 */
export function buildNextUpRows(params: {
  /** Today's sessions, already merged (attendance_sessions + timetable
   *  slots) and time-sorted, exactly as rendered by the itinerary hero. */
  todaySessions: NextUpSessionInput[]
  /** Whether this student has an open (`status: 'open'`) wellbeing survey. */
  hasOpenWellbeingSurvey: boolean
  /** The soonest upcoming fixture the student is squadded for, or null. */
  nextFixture: NextUpFixtureInput | null
  /** Always the server-computed instant — never the device clock. */
  now: Date
}): NextUpRow[] {
  const { todaySessions, hasOpenWellbeingSurvey, nextFixture, now } = params
  const rows: NextUpRow[] = []

  // Next session today: the first one that hasn't finished yet (live or
  // still upcoming). A session with no closes_at is treated as ongoing
  // until superseded by the next check.
  const nextSession = todaySessions.find(s => !(s.closes_at && new Date(s.closes_at) <= now))
  if (nextSession) {
    const opens = new Date(nextSession.opens_at)
    const closes = nextSession.closes_at ? new Date(nextSession.closes_at) : null
    const live = opens <= now && (!closes || closes > now)
    rows.push({
      kind: 'session',
      label: nextSession.session_label,
      timeLabel: opens.toLocaleTimeString('en-GB', LONDON_TIME_FMT),
      live,
    })
  }

  if (hasOpenWellbeingSurvey) {
    rows.push({ kind: 'wellbeing' })
  }

  if (nextFixture) {
    const daysLeft = Math.ceil((new Date(nextFixture.match_date).getTime() - now.getTime()) / 86_400_000)
    if (daysLeft <= 7) {
      const daysLabel = daysLeft <= 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`
      rows.push({
        kind: 'fixture',
        opponent: nextFixture.opponent,
        daysLabel,
        location: nextFixture.location ?? null,
      })
    }
  }

  return rows
}
