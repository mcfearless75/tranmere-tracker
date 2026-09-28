/**
 * Per-match GPS pod allocation.
 *
 * Catapult exports name a player only by pod ("Tranmere P13"), and pods are
 * handed out fresh every match — so the pod → player link lives on
 * match_squads.gps_number for that fixture, not on the player. A permanent
 * users.catapult_code cannot express "P13 was Caleb on 23/09 and someone else
 * next week", which is how a pod silently landed on the wrong player before.
 */

export const SQUAD_NUMBER_MIN = 1
export const SQUAD_NUMBER_MAX = 99

/** "Tranmere P13" → 13. Null when the text carries no pod number. */
export function podNumber(raw: string): number | null {
  const m = raw.match(/p\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

export type MatchCandidate = { id: string; opponent: string }

export type MatchPick<T extends MatchCandidate> =
  | { kind: 'none' }
  | { kind: 'ambiguous' }
  | { kind: 'match'; match: T }

/**
 * Chooses which of a day's matches a Catapult session belongs to. A single
 * match that day is taken as-is; with several, the opponent must appear in
 * the Session Title ("TR Prem vs Stockport County (H)"). Anything else is
 * ambiguous — guessing would put a whole squad's data on the wrong fixture.
 */
export function pickMatchForSession<T extends MatchCandidate>(
  matchesOnDate: T[],
  sessionTitle: string,
): MatchPick<T> {
  if (matchesOnDate.length === 0) return { kind: 'none' }
  if (matchesOnDate.length === 1) return { kind: 'match', match: matchesOnDate[0] }
  const title = sessionTitle.toLowerCase()
  const named = matchesOnDate.filter(m => m.opponent.trim() && title.includes(m.opponent.trim().toLowerCase()))
  return named.length === 1 ? { kind: 'match', match: named[0] } : { kind: 'ambiguous' }
}

export type NumberRow = { playerId: string; shirt: number | null; gps: number | null }

/** Player ids whose shirt, or whose pod, is shared with another player. */
export function findNumberClashes(rows: NumberRow[]): { shirt: Set<string>; gps: Set<string> } {
  const clashes = (key: 'shirt' | 'gps') => {
    const byNumber = new Map<number, string[]>()
    for (const r of rows) {
      const n = r[key]
      if (n == null) continue
      byNumber.set(n, [...(byNumber.get(n) ?? []), r.playerId])
    }
    return new Set([...byNumber.values()].filter(ids => ids.length > 1).flat())
  }
  return { shirt: clashes('shirt'), gps: clashes('gps') }
}

/** pod number → player id for one match's squad. */
export function buildPodMap(squad: { player_id: string; gps_number: number | null }[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const s of squad) {
    if (s.gps_number != null) map.set(s.gps_number, s.player_id)
  }
  return map
}
