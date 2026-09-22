import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who can be picked for a match squad — defined once, here.
 *
 * This used to be `role = 'student'`, repeated in three page files. That
 * silently excluded a coach who plays (Joseph Barton, Prem), who could
 * therefore never be added to a squad at all. match_squads.player_id is a
 * plain FK to users with no role constraint, so the database was never the
 * obstacle — only those three queries were.
 *
 * Team membership is the opt-in: anyone in a team is pickable, so no teamless
 * staff member leaks into a picker.
 */
export const ELIGIBLE_PLAYER_FILTER = 'role.eq.student,team_id.not.is.null'

/**
 * `columns` is passed through to .select() so each caller can ask for only
 * what it renders. Always filters is_active — one of the three original
 * queries did not, so deactivated students still appeared in the "Add players
 * later" picker.
 */
export function eligiblePlayers(supabase: SupabaseClient, columns: string) {
  return supabase
    .from('users')
    .select(columns)
    .eq('is_active', true)
    .or(ELIGIBLE_PLAYER_FILTER)
    .order('name')
}

/**
 * Puts players belonging to `teamId` (a match's own team) before everyone
 * else, preserving each half's original relative order — a stable
 * partition, not a full re-sort. eligiblePlayers() already orders
 * alphabetically, and callers (AddPlayersLater, FormationBuilder) must not
 * lose that ordering within either half.
 *
 * Nothing is filtered out: a player not on the match's team still appears,
 * just after the match's own team. When `teamId` is null/undefined (no team
 * on the match, or no match selected yet), the input order passes through
 * unchanged.
 */
export function sortByTeamFirst<T extends { team_id: string | null }>(
  players: T[],
  teamId: string | null | undefined,
): T[] {
  if (!teamId) return players
  const inTeam: T[] = []
  const others: T[] = []
  for (const p of players) {
    if (p.team_id === teamId) inTeam.push(p)
    else others.push(p)
  }
  return [...inTeam, ...others]
}
