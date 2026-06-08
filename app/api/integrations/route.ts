import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isIntegrationProvider, PROVIDER_META } from '@/lib/integrations/providers'
import {
  loadIntegrationConfig,
  saveIntegrationConfig,
} from '@/lib/integrations/store'
import { SECRET_SENTINEL } from '@/lib/integrations/clientView'

export const dynamic = 'force-dynamic'

interface SaveBody {
  provider?: unknown
  enabled?: unknown
  baseUrl?: unknown
  config?: unknown
}

/** Verifies the caller is an authenticated admin. Returns the user id or null. */
async function requireAdmin(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

/**
 * POST — upsert a provider's connection config (admin only).
 * Secret fields sent as SECRET_SENTINEL are preserved from the stored value, so
 * the masked UI never has to round-trip the real secret.
 */
export async function POST(request: NextRequest) {
  const adminUserId = await requireAdmin()
  if (!adminUserId) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  let body: SaveBody
  try {
    body = (await request.json()) as SaveBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isIntegrationProvider(body.provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }
  const provider = body.provider

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const meta = PROVIDER_META[provider]
  const baseUrl =
    typeof body.baseUrl === 'string' && body.baseUrl.trim() !== ''
      ? body.baseUrl.trim()
      : null

  const incoming =
    body.config && typeof body.config === 'object'
      ? (body.config as Record<string, unknown>)
      : {}

  // Start from the stored config so untouched secrets are preserved.
  const existing = await loadIntegrationConfig(provider)
  const merged: Record<string, string> = { ...existing.config }

  for (const field of meta.fields) {
    const raw = incoming[field.key]
    if (typeof raw !== 'string') continue
    if (field.secret && raw === SECRET_SENTINEL) continue // keep existing secret
    merged[field.key] = raw.trim()
  }

  try {
    await saveIntegrationConfig({
      provider,
      enabled: body.enabled,
      baseUrl,
      config: merged,
      updatedBy: adminUserId,
    })
  } catch {
    // Never log the config — it holds secrets.
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
