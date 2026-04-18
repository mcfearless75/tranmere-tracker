import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
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

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check username not already taken
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const taken = existingUsers?.users?.find(u => u.email === internalEmail)
  if (taken) return NextResponse.json({ error: `Username "${username}" is already taken` }, { status: 409 })

  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return NextResponse.json({ error: authError.message })

  await adminClient.from('users').upsert({
    id: created.user.id,
    email: internalEmail,
    name,
    role,
    course_id: courseId || null,
  })

  return NextResponse.json({ success: true })
}
