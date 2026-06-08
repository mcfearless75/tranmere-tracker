export interface UnitProgress {
  unitTitle: string
  submitted: number
  total: number
  pct: number
}

export interface GradeBreakdown {
  pass: number
  merit: number
  distinction: number
  notSubmitted: number
}

const SUBMITTED_STATUSES = new Set(['submitted', 'graded'])

export function calcUnitProgress(
  assignments: Array<{ unit_title: string; status: string }>
): UnitProgress[] {
  const map = new Map<string, { submitted: number; total: number }>()

  for (const a of assignments) {
    const entry = map.get(a.unit_title) ?? { submitted: 0, total: 0 }
    entry.total += 1
    if (SUBMITTED_STATUSES.has(a.status)) {
      entry.submitted += 1
    }
    map.set(a.unit_title, entry)
  }

  return Array.from(map.entries())
    .map(([unitTitle, { submitted, total }]) => ({
      unitTitle,
      submitted,
      total,
      pct: total > 0 ? Math.round((submitted / total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
}

export function calcGradeBreakdown(
  assignments: Array<{ grade?: string | null; status: string }>
): GradeBreakdown {
  const result: GradeBreakdown = { pass: 0, merit: 0, distinction: 0, notSubmitted: 0 }

  for (const a of assignments) {
    if (!SUBMITTED_STATUSES.has(a.status)) {
      result.notSubmitted += 1
      continue
    }
    const g = (a.grade ?? '').toLowerCase().trim()
    if (g === 'pass') result.pass += 1
    else if (g === 'merit') result.merit += 1
    else if (g === 'distinction') result.distinction += 1
    else result.notSubmitted += 1
  }

  return result
}

export function overallCompletionPct(units: UnitProgress[]): number {
  if (units.length === 0) return 0
  const avg = units.reduce((sum, u) => sum + u.pct, 0) / units.length
  return Math.round(avg)
}
