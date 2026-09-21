/**
 * Shared user constants.
 *
 * These live outside app/(admin)/admin/users/userActions.ts because that file
 * is `'use server'`, and a server-action module may only export async
 * functions — exporting a plain const from it fails the webpack build (tsc and
 * Jest both pass, so the build is the only thing that catches it).
 */

/**
 * users.name is plain `text` with no DB limit, so this cap is the app's own.
 * The input carries the same maxLength and the server re-checks it — an
 * over-long name is REJECTED rather than silently truncated, which is the
 * failure mode that bit the chat and folder name fields (2026-09-14 sweep).
 */
export const USER_NAME_MAX = 80
