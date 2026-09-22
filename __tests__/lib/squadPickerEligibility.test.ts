/**
 * Source-level guard for the "who can be picked for a squad" defect class.
 *
 * The real filtering happens inside PostgREST (`eligiblePlayers()`'s
 * `.eq('is_active', true)` + `.or(ELIGIBLE_PLAYER_FILTER)`), so a unit test
 * can't exercise that end-to-end without a live database. What we CAN and
 * must prove is that the three squad-picker pages actually call the shared
 * helper instead of re-rolling their own `role = 'student'` query — that
 * hand-rolled filter is exactly what excluded a coach who plays (Joseph
 * Barton) and, on the match-detail page, what let deactivated students keep
 * appearing in "Add players later" (it had no `is_active` filter at all).
 *
 * This is a deliberate regression guard against a defect class that has
 * already escaped three prior manual sweeps (see 2026-09-11's
 * deactivated-students reconciliation) — read the source files from disk so
 * a reintroduced hand-rolled query fails this test, not just a live check.
 */
import fs from 'fs'
import path from 'path'

const PAGES = [
  'app/(admin)/admin/match-events/page.tsx',
  'app/(admin)/admin/match-events/[id]/page.tsx',
  'app/(admin)/admin/formation/page.tsx',
]

function readPage(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('squad picker eligibility — no hand-rolled role filter survives', () => {
  it.each(PAGES)('%s does not contain a literal role/student filter', relPath => {
    const source = readPage(relPath)
    expect(source).not.toMatch(/role'\s*,\s*'student'/)
    expect(source).not.toMatch(/role"\s*,\s*"student"/)
  })

  it.each(PAGES)('%s imports eligiblePlayers from lib/teams/players', relPath => {
    const source = readPage(relPath)
    expect(source).toMatch(/import\s*\{\s*eligiblePlayers\s*\}\s*from\s*['"]@\/lib\/teams\/players['"]/)
  })

  it.each(PAGES)('%s actually calls eligiblePlayers(...)', relPath => {
    const source = readPage(relPath)
    expect(source).toMatch(/eligiblePlayers\(/)
  })
})
