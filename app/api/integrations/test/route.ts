import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdapter, isIntegrationProvider } from '@/lib/integrations/providers'
import { loadIntegrationConfig } from '@/lib/integrations/store'

export const dynamic = 'force-dynamic'

interface TestBody {
  provider?: unknown
}

async function requireAdmin(): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return !!profile && profile.role === 'admin'
}

/**
 * POST — run the provider adapter's testConnection (admin only).
 * Until real credentials/vendor calls exist this reports "not configured".
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  let body: TestBody
  try {
    body = (await request.json()) as TestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isIntegrationProvider(body.provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const config = await loadIntegrationConfig(body.provider)
  const adapter = getAdapter(config)
  const result = await adapter.testConnection()

  // result.message is intentionally generic — it never echoes secret values.
  return NextResponse.json({ success: true, result })
}
