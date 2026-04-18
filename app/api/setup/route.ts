import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Fixed internal email for the superuser — never shown to the user
const SUPERUSER_EMAIL = 'superuser@tranmeretracker.internal'

export async function POST(request: Request) {
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Only allow if no admin exists
  const { data: existing } = await adminClient
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 403 })
  }

  const { name, pin } = await request.json()
  if (!name || !pin) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }
  if (!/^\d{5,6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 5 or 6 digits' }, { status: 400 })
  }

  // Delete any existing superuser auth entry so re-setup works cleanly
  const { data: existing_auth } = await adminClient.auth.admin.listUsers()
  const prev = existing_auth?.users?.find(u => u.email === SUPERUSER_EMAIL)
  if (prev) await adminClient.auth.admin.deleteUser(prev.id)

  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email: SUPERUSER_EMAIL,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return NextResponse.json({ error: authError.message })

  await adminClient.from('users').upsert({
    id: created.user.id,
    email: SUPERUSER_EMAIL,
    name,
    role: 'admin',
  })

  return NextResponse.json({ success: true })
}
