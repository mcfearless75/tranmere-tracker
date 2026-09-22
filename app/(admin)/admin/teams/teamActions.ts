'use server'
import { revalidatePath } from 'next/cache'
import { requireStaffAction, type StaffContext } from '@/lib/auth/requireRole'
import { TEAM_NAME_MAX, type ActionResult } from '@/lib/teams/types'

/**
 * Server actions behind the Teams page.
 *
 * These run with the service-role client, which bypasses RLS entirely, and a
 * Next.js server action is reachable by anyone who has the action id from the
 * client bundle — it is NOT implicitly protected by the /admin layout. So each
 * one verifies the caller itself, per the contract in lib/auth/requireRole.ts:
 * "every route or action that uses it MUST verify the caller's role in
 * application code".
 *
 * All six return {ok, error} rather than throwing. Next.js redacts a thrown
 * Server Action error in production into an opaque digest, so a throw cannot
 * carry a reason to the client — "You need permission" became a generic "Not
 * saved". A returned error survives.
 *
 * That now includes the authorization refusal, which was the last path still
 * throwing. A signed-out or expired session IS user-correctable — "sign in
 * again" is something they can act on — but redaction turned it into the same
 * "Not saved — try again" as everything else. It is returned instead, so the
 * only throw left is the request genuinely never reaching the server.
 */

const NO_PERMISSION = 'You do not have permission to make that change — try signing in again'

/**
 * requireStaffAction throws by design (a server action cannot return an HTTP
 * response). Converting it to a result once here keeps the throw-vs-return
 * decision in one place instead of at six call sites.
 */
async function staffContext(): Promise<
  { ok: true; ctx: StaffContext } | { ok: false; error: string }
> {
  try {
    return { ok: true, ctx: await requireStaffAction() }
  } catch {
    return { ok: false, error: NO_PERMISSION }
  }
}

function revalidate() {
  revalidatePath('/admin/teams')
  revalidatePath('/admin/users')
  revalidatePath('/admin/match-events')
}

/** Returns the cleaned name, or the reason it is unusable. */
function cleanName(name: string): { name: string } | { error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Team name cannot be empty' }
  if (trimmed.length > TEAM_NAME_MAX) {
    return { error: `Team name cannot be longer than ${TEAM_NAME_MAX} characters` }
  }
  return { name: trimmed }
}

/**
 * Puts one user in a team, or takes them out of one with null.
 *
 * Unlike updateUserYearGroup, this does NOT require the target to be a
 * student. Joseph Barton is a coach who plays and is on the Prem sheet, and
 * team membership is what makes someone pickable for a squad — so refusing
 * non-students here would defeat the point.
 *
 * Assignment replaces: users.team_id holds one value, so there is no state in
 * which a player accumulates two teams.
 */
export async function setUserTeam(userId: string, teamId: string | null): Promise<ActionResult> {
  const auth = await staffContext()
  if (!auth.ok) return auth
  const { admin } = auth.ctx

  const { error } = await admin.from('users').update({ team_id: teamId }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/** Bulk form of setUserTeam, for the Add players flow. */
export async function setUsersTeam(userIds: string[], teamId: string | null): Promise<ActionResult> {
  const auth = await staffContext()
  if (!auth.ok) return auth
  const { admin } = auth.ctx

  if (userIds.length === 0) return { ok: true }
  const { error } = await admin.from('users').update({ team_id: teamId }).in('id', userIds)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function createTeam(name: string): Promise<ActionResult> {
  const auth = await staffContext()
  if (!auth.ok) return auth
  const { admin } = auth.ctx

  const clean = cleanName(name)
  if ('error' in clean) return { ok: false, error: clean.error }

  // A new team must land AFTER every existing one — sort_order: 0 collided
  // with the seeded Prem (also 0), leaving .order('sort_order') with an
  // unbroken tie and the new team's on-page position nondeterministic between
  // loads. Retired teams are included in the max: a team retired at the end
  // of the list should not free up its old slot for a new one to (sometimes)
  // sort ahead of teams that were never touched.
  const { data: existing, error: maxError } = await admin
    .from('teams')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  if (maxError) return { ok: false, error: maxError.message }
  const nextSortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1

  const { error } = await admin.from('teams').insert({ name: clean.name, sort_order: nextSortOrder })
  // The partial unique index is the backstop against two coaches adding the
  // same team at once, so a race surfaces here as a reported error rather
  // than a duplicate row.
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function renameTeam(teamId: string, name: string): Promise<ActionResult> {
  const auth = await staffContext()
  if (!auth.ok) return auth
  const { admin } = auth.ctx

  const clean = cleanName(name)
  if ('error' in clean) return { ok: false, error: clean.error }

  const { error } = await admin.from('teams').update({ name: clean.name }).eq('id', teamId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function reorderTeams(orderedIds: string[]): Promise<ActionResult> {
  const auth = await staffContext()
  if (!auth.ok) return auth
  const { admin } = auth.ctx

  if (orderedIds.length === 0) return { ok: true }

  // One upsert, not one UPDATE per team: the previous per-row loop was N
  // round trips for a single chevron tap, AND returned on the first error —
  // a failure partway through left the order half-applied (team 1
  // renumbered, 2 and 3 not) rather than atomically all-or-nothing.
  //
  // teams.name is NOT NULL with no default, so an upsert row carrying only
  // {id, sort_order} fails Postgres's NOT NULL check on the candidate insert
  // row even though every id here already exists and can only ever hit the
  // ON CONFLICT branch — the existing name/is_active have to come along too.
  const { data: current, error: readError } = await admin
    .from('teams')
    .select('id, name, is_active')
    .in('id', orderedIds)
  if (readError) return { ok: false, error: readError.message }

  const byId = new Map(
    (current ?? []).map((t: { id: string; name: string; is_active: boolean }) => [t.id, t])
  )
  const rows = orderedIds.map((id, sort_order) => {
    const t = byId.get(id)
    return { id, sort_order, name: t?.name ?? '', is_active: t?.is_active ?? true }
  })

  const { error } = await admin.from('teams').upsert(rows)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/**
 * Retires or restores a team.
 *
 * Retiring deliberately leaves players' team_id alone, so restoring brings the
 * whole roster back. A player whose team is retired is treated as unassigned
 * everywhere a picker asks for active teams.
 */
export async function setTeamActive(teamId: string, active: boolean): Promise<ActionResult> {
  const auth = await staffContext()
  if (!auth.ok) return auth
  const { admin } = auth.ctx

  const { error } = await admin.from('teams').update({ is_active: active }).eq('id', teamId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}
