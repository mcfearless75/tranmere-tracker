/**
 * Server-only persistence helpers for integration configs. Uses the admin
 * (service-role) client because the table denies all RLS access by design.
 *
 * NEVER import this into client components — it touches secrets.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { IntegrationConfig, IntegrationProvider } from './types'
import { PROVIDER_LIST } from './providers'

interface IntegrationConfigRow {
  provider: IntegrationProvider
  enabled: boolean
  base_url: string | null
  config: Record<string, string> | null
}

function rowToConfig(provider: IntegrationProvider, row: IntegrationConfigRow | null): IntegrationConfig {
  return {
    provider,
    enabled: row?.enabled ?? false,
    baseUrl: row?.base_url ?? null,
    config: row?.config ?? {},
  }
}

/** Load a single provider's stored config (defaults if no row yet). */
export async function loadIntegrationConfig(
  provider: IntegrationProvider,
): Promise<IntegrationConfig> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('integration_configs')
    .select('provider, enabled, base_url, config')
    .eq('provider', provider)
    .maybeSingle()

  return rowToConfig(provider, (data as IntegrationConfigRow | null) ?? null)
}

/** Load every provider's config, defaulting any missing rows. */
export async function loadAllIntegrationConfigs(): Promise<IntegrationConfig[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('integration_configs')
    .select('provider, enabled, base_url, config')

  const rows = (data as IntegrationConfigRow[] | null) ?? []
  const byProvider = new Map<IntegrationProvider, IntegrationConfigRow>(
    rows.map((r) => [r.provider, r]),
  )

  return PROVIDER_LIST.map((meta) =>
    rowToConfig(meta.provider, byProvider.get(meta.provider) ?? null),
  )
}

export interface SaveIntegrationInput {
  provider: IntegrationProvider
  enabled: boolean
  baseUrl: string | null
  config: Record<string, string>
  updatedBy: string
}

/**
 * Upsert a provider's config. Secret values that arrive as the masked sentinel
 * are preserved from the existing row rather than overwritten with the mask.
 */
export async function saveIntegrationConfig(input: SaveIntegrationInput): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('integration_configs').upsert(
    {
      provider: input.provider,
      enabled: input.enabled,
      base_url: input.baseUrl,
      config: input.config,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'provider' },
  )

  if (error) {
    throw new Error(`Failed to save integration config: ${error.message}`)
  }
}
