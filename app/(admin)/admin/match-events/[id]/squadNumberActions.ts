'use server'
import { revalidatePath } from 'next/cache'
import { requireStaffAction } from '@/lib/auth/requireRole'
import type { ActionResult } from '@/lib/teams/types'
import { findNumberClashes, SQUAD_NUMBER_MAX, SQUAD_NUMBER_MIN } from '@/lib/gps/matchPods'

export type SquadNumberInput = { squadId: string; shirt: number | null; gps: number | null }

function validNumber(n: number | null): boolean {
  return n === null || (Number.isInteger(n) && n >= SQUAD_NUMBER_MIN && n <= SQUAD_NUMBER_MAX)
}

/**
 * Saves every squad row's shirt + pod for one match in a single upsert.
 *
 * One statement, not a loop of updates: the per-match unique constraints are
 * DEFERRABLE INITIALLY DEFERRED (migration 088), so a swap is only legal when
 * both rows change inside the same transaction — and two PostgREST calls are
 * two transactions.
 *
 * Service-role client, so the caller is verified here; returns {ok, error}
 * because a thrown Server Action error is redacted in production.
 */
export async function saveSquadNumbers(matchId: string, rows: SquadNumberInput[]): Promise<ActionResult> {
  let admin
  try {
    ;({ admin } = await requireStaffAction())
  } catch {
    return { ok: false, error: 'You do not have permission to make that change — try signing in again' }
  }

  if (rows.some(r => !validNumber(r.shirt) || !validNumber(r.gps))) {
    return { ok: false, error: `Numbers must be whole numbers from ${SQUAD_NUMBER_MIN} to ${SQUAD_NUMBER_MAX}` }
  }

  const clashes = findNumberClashes(rows.map(r => ({ playerId: r.squadId, shirt: r.shirt, gps: r.gps })))
  if (clashes.shirt.size) return { ok: false, error: 'Two players have the same shirt number' }
  if (clashes.gps.size) return { ok: false, error: 'Two players have the same GPS pod' }

  const { data: squad, error: squadError } = await admin
    .from('match_squads')
    .select('id, player_id')
    .eq('match_id', matchId)
  if (squadError) return { ok: false, error: squadError.message }

  const playerBySquadId = new Map((squad ?? []).map(s => [s.id as string, s.player_id as string]))
  if (rows.some(r => !playerBySquadId.has(r.squadId))) {
    return { ok: false, error: 'The squad changed while you were editing — refresh and try again' }
  }
  if (rows.length === 0) return { ok: true }

  const { error } = await admin.from('match_squads').upsert(
    rows.map(r => ({
      id: r.squadId,
      match_id: matchId,
      player_id: playerBySquadId.get(r.squadId),
      shirt_number: r.shirt,
      gps_number: r.gps,
    })),
    { onConflict: 'id' },
  )
  if (error) {
    // 23505 = unique_violation: a number is taken by a squad row not in this
    // save (e.g. a declined player still holding it).
    if (error.code === '23505') return { ok: false, error: 'That number is already used by another player in this match' }
    return { ok: false, error: error.message }
  }

  revalidatePath(`/admin/match-events/${matchId}`)
  return { ok: true }
}
