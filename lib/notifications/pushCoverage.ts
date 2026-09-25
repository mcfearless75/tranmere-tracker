import type { SupabaseClient } from '@supabase/supabase-js'

export type CoverageUser = { id: string; name: string | null; role: string }

export type PushCoverage = {
  total: number
  reachable: number
  /** Active students/staff with no web-push subscription and no native token. */
  unreachable: CoverageUser[]
}

const TRACKED_ROLES = ['student', 'coach', 'teacher', 'admin']

/**
 * Pure: who can actually receive a push. A user counts as reachable if they
 * have at least one device on either channel — the same two tables every
 * sender in the app reads from.
 */
export function summarisePushCoverage(
  users: CoverageUser[],
  webPushUserIds: string[],
  nativeUserIds: string[],
): PushCoverage {
  const reachableIds = new Set([...webPushUserIds, ...nativeUserIds])
  const tracked = users.filter(u => TRACKED_ROLES.includes(u.role))
  const unreachable = tracked
    .filter(u => !reachableIds.has(u.id))
    .sort((a, b) => a.role.localeCompare(b.role) || (a.name ?? '').localeCompare(b.name ?? ''))
  return { total: tracked.length, reachable: tracked.length - unreachable.length, unreachable }
}

export async function getPushCoverage(admin: SupabaseClient): Promise<PushCoverage> {
  const [{ data: users }, { data: web }, { data: native }] = await Promise.all([
    admin.from('users').select('id, name, role').eq('is_active', true).in('role', TRACKED_ROLES),
    admin.from('push_subscriptions').select('user_id'),
    admin.from('native_push_tokens').select('user_id'),
  ])
  return summarisePushCoverage(
    (users ?? []) as CoverageUser[],
    (web ?? []).map(r => r.user_id as string),
    (native ?? []).map(r => r.user_id as string),
  )
}
