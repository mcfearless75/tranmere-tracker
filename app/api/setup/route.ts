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

  // Only allow if no admin exists. Fail CLOSED: a query error must lock the
  // route, not open it — otherwise a transient DB error re-opens bootstrap.
  const { data: existing, error: existingError } = await adminClient
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (existingError) {
    return NextResponse.json({ error: 'Setup unavailable' }, { status: 503 })
  }
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

  // Never delete or replace an existing superuser auth account. If one exists
  // (even without an admin row in public.users — e.g. a half-broken state),
  // refuse and leave repair to a human with service-role access.
  const { data: existing_auth, error: listError } = await adminClient.auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: 'Setup unavailable' }, { status: 503 })
  }
  const prev = existing_auth?.users?.find(u => u.email === SUPERUSER_EMAIL)
  if (prev) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 403 })
  }

  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email: SUPERUSER_EMAIL,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { error: upsertError } = await adminClient.from('users').upsert({
    id: created.user.id,
    email: SUPERUSER_EMAIL,
    name,
    role: 'admin',
  })

  if (upsertError) {
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
