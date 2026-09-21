'use server'
import { revalidatePath } from 'next/cache'
import { requireStaffAction } from '@/lib/auth/requireRole'
import { USER_NAME_MAX } from '@/lib/users/types'

/**
 * Server actions behind the Users table.
 *
 * These run with the service-role client, which bypasses RLS entirely, and a
 * Next.js server action is reachable by anyone who has the action id from the
 * client bundle — it is NOT implicitly protected by the /admin layout. So each
 * one verifies the caller itself, per the contract in lib/auth/requireRole.ts:
 * "every route or action that uses it MUST verify the caller's role in
 * application code".
 */

const STAFF_TARGET_ROLES = new Set(['coach', 'teacher', 'admin'])
const VALID_ROLES = new Set(['student', 'coach', 'teacher', 'admin'])
/** Mirrors chat_rooms_sync_year_group_check (044_group_chat.sql). */
const VALID_YEAR_GROUPS = new Set([1, 2])

export async function updateUserRole(userId: string, role: string) {
  const { role: callerRole, admin } = await requireStaffAction()
  if (!VALID_ROLES.has(role)) throw new Error('Invalid role')
  // Granting staff access is admin-only — same rule the create-user route
  // already enforces, so a coach cannot mint another admin.
  if (STAFF_TARGET_ROLES.has(role) && callerRole !== 'admin') {
    throw new Error('Only an admin can grant staff roles')
  }
  await admin.from('users').update({ role }).eq('id', userId)
  revalidatePath('/admin/users')
}

export async function updateUserCourse(userId: string, courseId: string) {
  const { admin } = await requireStaffAction()
  await admin.from('users').update({ course_id: courseId || null }).eq('id', userId)
  revalidatePath('/admin/users')
}

/**
 * Sets which year group a student is in.
 *
 * This is the only write path for users.year_group in the whole app. Until it
 * existed the column was set once by its DB default of 1 and could never be
 * changed from the UI, so every Year 2 joiner silently became a Year 1
 * student — wrong timetable, wrong calendar, wrong squad grouping, and the
 * wrong auto-synced chat (which is how it was noticed).
 *
 * The sync_year_group_chat trigger moves them between the Year 1/2 chats in
 * the same transaction, so no chat membership change is needed here.
 */
export async function updateUserYearGroup(userId: string, yearGroup: number) {
  const { admin } = await requireStaffAction()
  if (!VALID_YEAR_GROUPS.has(yearGroup)) throw new Error('Invalid year group')

  const { data: target } = await admin
    .from('users').select('role').eq('id', userId).maybeSingle()
  // year_group is only meaningful for students — it defaults to 1 on every
  // row, staff included, and setting it on staff would be noise.
  if (target?.role !== 'student') throw new Error('Year group applies to students only')

  await admin.from('users').update({ year_group: yearGroup }).eq('id', userId)
  revalidatePath('/admin/users')
  revalidatePath(`/admin/students/${userId}`)
}

/**
 * Renames a user.
 *
 * users.name is set once by handle_new_user() from the signup metadata (or,
 * failing that, the local part of the email address) and had no write path
 * anywhere in the app — so a typo, a missing surname, or a name imported from
 * the wrong column was permanent. Staff-editable here, alongside year group.
 *
 * The name is what identifies a student in the roster, chat, squads and every
 * printed report, so it is trimmed and length-checked rather than stored raw.
 */
export async function updateUserName(userId: string, name: string) {
  const { admin } = await requireStaffAction()

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name cannot be empty')
  if (trimmed.length > USER_NAME_MAX) {
    throw new Error(`Name cannot be longer than ${USER_NAME_MAX} characters`)
  }

  await admin.from('users').update({ name: trimmed }).eq('id', userId)
  revalidatePath('/admin/users')
  revalidatePath(`/admin/students/${userId}`)
}
