import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const STAFF_ROLES = ['admin', 'coach', 'teacher']

/**
 * Staff gate for the youth API routes. Returns the authenticated staff
 * user's id, or null when the request is unauthenticated or the user is
 * not admin/coach/teacher.
 */
export async function requireStaff(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !STAFF_ROLES.includes(profile.role)) return null
  return user.id
}
