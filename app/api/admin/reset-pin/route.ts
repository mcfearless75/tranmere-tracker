import { requireStaff } from '@/lib/auth/requireRole'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STAFF_TARGET_ROLES = new Set(['coach', 'teacher', 'admin'])

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { role: callerRole, admin } = auth.ctx

  const { userId, newPin } = await request.json()
  if (!userId || !newPin) {
    return NextResponse.json({ error: 'userId and newPin required' }, { status: 400 })
  }
  if (!/^\d{5,6}$/.test(newPin)) {
    return NextResponse.json({ error: 'PIN must be 5 or 6 digits' }, { status: 400 })
  }

  // Privilege-escalation guard: only an admin may reset a staff/admin account's
  // PIN. Prevents a coach/teacher from resetting the superuser and taking over.
  const { data: target } = await admin.from('users').select('role, email').eq('id', userId).maybeSingle()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if ((STAFF_TARGET_ROLES.has(target.role) || target.email === 'superuser@tranmeretracker.internal') && callerRole !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can reset a staff account PIN' }, { status: 403 })
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPin })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: `PIN reset. They can now sign in with PIN ${newPin}.` })
}
