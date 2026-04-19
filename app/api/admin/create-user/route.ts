import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { username, name, role, courseId, pin } = await request.json()

  if (!username || !name || !role || !pin) {
    return NextResponse.json({ error: 'username, name, role and pin are required' }, { status: 400 })
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
