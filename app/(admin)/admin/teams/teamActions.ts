'use server'

import { revalidatePath } from 'next/cache'
import { requireStaffAction } from '@/lib/auth/requireRole'
import { TEAM_NAME_MAX, type ActionResult } from '@/lib/teams/types'

/**
 * Server actions behind the Teams page.
 *
 * These actions are reachable by action id and are NOT protected by the
 * /admin layout, so every action must open with requireStaffAction().
 */

function revalidate() {
  revalidatePath('/admin/teams')
}

type CleanNameResult = { name: string } | { error: string }

function cleanName(name: string): CleanNameResult {
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: 'Team name cannot be empty' }
  }
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
 * Assignment replaces: users.team_id holds one value, so there is no stacking
 * or multi-team membership. The update is idempotent.
 */
export async function setUserTeam(userId: string, teamId: string | null): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const { error } = await admin.from('users').update({ team_id: teamId }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/**
 * Bulk-assigns multiple users to the same team, or removes them all with null.
 *
 * Replaces each user's current team_id with the new one. Useful for seeding
 * rosters or moving a squad between teams.
 */
export async function setUsersTeam(userIds: string[], teamId: string | null): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const { error } = await admin.from('users').update({ team_id: teamId }).eq('id', userIds)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/**
 * Creates a new team with a staff-given name.
 *
 * The partial unique index (on name, WHERE is_active = true) is the backstop
 * against two coaches adding the same team at once, so a race surfaces here
 * as a reported error rather than a duplicate row.
 */
export async function createTeam(name: string): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const clean = cleanName(name)
  if ('error' in clean) return { ok: false, error: clean.error }

  const { error } = await admin.from('teams').insert({ name: clean.name, sort_order: 0 })
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/**
 * Renames an existing team.
 *
 * The name is re-validated server-side before any write.
 */
export async function renameTeam(teamId: string, name: string): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const clean = cleanName(name)
  if ('error' in clean) return { ok: false, error: clean.error }

  const { error } = await admin.from('teams').update({ name: clean.name }).eq('id', teamId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/**
 * Reorders teams by reassigning their sort_order.
 *
 * Takes an array of team IDs in the desired order and assigns sort_order 0, 1, 2, ...
 */
export async function reorderTeams(orderedIds: string[]): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await admin.from('teams').update({ sort_order: i }).eq('id', orderedIds[i])
    if (error) return { ok: false, error: error.message }
  }
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
  const { admin } = await requireStaffAction()
  const { error } = await admin.from('teams').update({ is_active: active }).eq('id', teamId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}
