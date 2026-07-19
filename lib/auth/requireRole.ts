import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Centralised authorization for endpoints that use the service-role client.
 *
 * The service-role client bypasses RLS, so every route or action that uses it
 * MUST verify the caller's role in application code — middleware does not guard
 * /api paths. These helpers do that once, correctly, in one place.
 */

export const STAFF_ROLES = ['admin', 'coach', 'teacher'] as const
export const ADMIN_ROLES = ['admin'] as const

export interface StaffContext {
  user: User
  role: string
  /** Service-role client, safe to reuse now that the role is verified. */
  admin: SupabaseClient
}

type AuthResult =
  | { ok: true; ctx: StaffContext }
  | { ok: false; response: NextResponse }

async function resolve(allowed: readonly string[]): Promise<
  | { ok: true; ctx: StaffContext }
  | { ok: false; status: 401 | 403 }
> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !allowed.includes(profile.role)) {
    return { ok: false, status: 403 }
  }
  return { ok: true, ctx: { user, role: profile.role, admin } }
}

function toResponse(status: 401 | 403): NextResponse {
  return status === 401
    ? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** API-route guard: caller must be admin, coach or teacher. */
export async function requireStaff(): Promise<AuthResult> {
  const r = await resolve(STAFF_ROLES)
  return r.ok ? { ok: true, ctx: r.ctx } : { ok: false, response: toResponse(r.status) }
}

/** API-route guard: caller must be admin. */
export async function requireAdmin(): Promise<AuthResult> {
  const r = await resolve(ADMIN_ROLES)
  return r.ok ? { ok: true, ctx: r.ctx } : { ok: false, response: toResponse(r.status) }
}

/**
 * Server-action guard: returns the verified context or throws.
 * Server actions cannot return an HTTP response, so a thrown error is the
 * correct failure mode (surfaces as a rejected action to the client).
 */
export async function requireStaffAction(): Promise<StaffContext> {
  const r = await resolve(STAFF_ROLES)
  if (!r.ok) throw new Error(r.status === 401 ? 'Unauthorised' : 'Forbidden')
  return r.ctx
}
