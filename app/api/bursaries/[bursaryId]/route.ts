import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isBursaryStatus } from '@/lib/bursaries/bursaryUtils'

export const dynamic = 'force-dynamic'

async function requireAdmin(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') return null
  return user.id
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { bursaryId: string } },
) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status } = (body ?? {}) as Record<string, unknown>

  if (!isBursaryStatus(status)) {
    return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bursaries')
    .update({ status })
    .eq('id', params.bursaryId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Bursary not found' }, { status: 404 })

  return NextResponse.json({ bursary: data })
}
