import { requireStaff } from '@/lib/auth/requireRole'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CREATABLE_ROLES = ['student', 'parent', 'coach', 'teacher', 'admin'] as const
const STAFF_TARGET_ROLES = new Set(['coach', 'teacher', 'admin'])

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { role: callerRole, admin: adminClient } = auth.ctx

  const { username, name, role, courseId, pin } = await request.json()

  if (!username || !name || !role || !pin) {
    return NextResponse.json({ error: 'username, name, role and pin are required' }, { status: 400 })
  }
  if (!CREATABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  // Privilege-escalation guard: only an admin may create staff/admin accounts.
  if (STAFF_TARGET_ROLES.has(role) && callerRole !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can create staff accounts' }, { status: 403 })
  }
  if (!/^\d{5,6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 5 or 6 digits' }, { status: 400 })
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: 'Username can only contain lowercase letters, numbers and underscores' }, { status: 400 })
  }

  const internalEmail = `${username}@tranmeretracker.internal`

  // Check if the auth user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existingAuth = existingUsers?.users?.find(u => u.email === internalEmail)

  if (existingAuth) {
    // Is there a profile row already?
    const { data: existingProfile } = await adminClient
      .from('users')
      .select('id')
      .eq('id', existingAuth.id)
      .maybeSingle()

    if (existingProfile) {
      // Fully exists — genuine conflict
      return NextResponse.json({ error: `Username "${username}" is already taken` }, { status: 409 })
    }

    // Orphaned auth user — no profile row. Recover by creating the profile
    // and resetting the password to the new PIN.
    await adminClient.auth.admin.updateUserById(existingAuth.id, {
      password: pin,
      user_metadata: { full_name: name },
    })

    const { error: upsertError } = await adminClient.from('users').upsert({
      id: existingAuth.id,
      email: internalEmail,
      name,
      role,
      course_id: courseId || null,
    })
    if (upsertError) return NextResponse.json({ error: `Recovery failed: ${upsertError.message}` })

    return NextResponse.json({
      success: true,
      recovered: true,
      message: `Recovered existing account for "${username}" and set new PIN.`,
    })
  }

  // Fresh create
  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return NextResponse.json({ error: authError.message })

  const { error: upsertError } = await adminClient.from('users').upsert({
    id: created.user.id,
    email: internalEmail,
    name,
    role,
    course_id: courseId || null,
  })

  if (upsertError) {
    // Profile save failed — roll back the auth user so we don't leave an orphan
    await adminClient.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: `Profile save failed: ${upsertError.message}` })
  }

  return NextResponse.json({ success: true })
}
