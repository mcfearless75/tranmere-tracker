import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

  const { name, email, password, pin } = await request.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  if (process.env.SETUP_PIN && pin !== process.env.SETUP_PIN) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 })
  }

  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return NextResponse.json({ error: authError.message })

  await adminClient.from('users').upsert({
    id: created.user.id,
    email,
    name,
    role: 'admin',
  })

  return NextResponse.json({ success: true })
}
