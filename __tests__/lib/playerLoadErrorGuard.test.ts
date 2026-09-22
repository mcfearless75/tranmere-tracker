/**
 * Finding 4 from the whole-branch review: eligiblePlayers() depends on
 * users.team_id, the teams table, and the teams(id,name) embed — none of
 * which exist until migration 084 is applied. If this branch deploys before
 * that manual migration step runs, PostgREST 400s the query, `data` comes
 * back null, and `students ?? []` swallowed it — three pages rendered an
 * empty player grid with no explanation, and AddPlayersLater returned null
 * and vanished entirely.
 *
 * A live PostgREST failure isn't reachable from a unit test, so — same
 * technique as squadPickerEligibility.test.ts for the sibling defect class —
 * this reads the three page sources from disk and proves each one (a)
 * actually captures the query's error and (b) renders the shared error
 * state instead of quietly continuing when that error is set.
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

describe('a failed eligiblePlayers() query surfaces a visible error, not an empty list', () => {
  it.each(PAGES)('%s captures the error from its students query rather than discarding it', relPath => {
    const source = readPage(relPath)
    expect(source).toMatch(/data:\s*students,\s*error:\s*studentsError/)
  })

  it.each(PAGES)('%s renders PlayerLoadError when that error is set, instead of continuing silently', relPath => {
    const source = readPage(relPath)
    expect(source).toMatch(/studentsError\s*\?\s*\(\s*<PlayerLoadError/)
  })

  it.each(PAGES)('%s imports PlayerLoadError from the shared component', relPath => {
    const source = readPage(relPath)
    expect(source).toMatch(/import\s*\{\s*PlayerLoadError\s*\}\s*from\s*['"]@\/components\/PlayerLoadError['"]/)
  })
})
