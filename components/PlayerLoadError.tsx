/**
 * Shown instead of an empty player list when the eligiblePlayers() query
 * itself failed — most commonly because this branch's migration
 * (084_teams.sql) has not been applied yet, so `users.team_id` or the
 * `teams` table don't exist and PostgREST 400s the query.
 *
 * Without this, `{ data: students }` destructuring with `?? []` on a failed
 * query silently renders an empty grid: Formation Builder, Create Match and
 * Add Players Later all just look like "no players", and AddPlayersLater
 * returns null and vanishes entirely — nothing tells the coach why, and
 * nothing they can report. Shared by all three pages that depend on
 * eligiblePlayers() so the message is identical everywhere it can happen.
 */
export function PlayerLoadError() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-4" role="alert">
      Could not load players. This usually means the app needs a database update — tell Paul.
    </div>
  )
}
