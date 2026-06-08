/**
 * Shared types for the external integration scaffolding.
 *
 * Adapters are deliberately thin: each provider exposes a `testConnection` and a
 * set of `fetchX` stubs that THROW `IntegrationNotConfiguredError` until real
 * credentials are saved. The moment valid creds exist, the stub bodies are
 * replaced with real vendor calls — no wiring changes required elsewhere.
 */

export type IntegrationProvider =
  | 'moodle'
  | 'veo'
  | 'catapult'
  | 'guru'
  | 'sports_session_planner'

/** A single credential/config field rendered in the admin UI. */
export interface IntegrationField {
  /** key used inside the stored `config` jsonb */
  key: string
  label: string
  /** secret fields are masked in the UI and never returned to the client */
  secret: boolean
  placeholder?: string
}

/** Static description of a provider — used to render the admin UI and registry. */
export interface IntegrationProviderMeta {
  provider: IntegrationProvider
  /** human-facing name, e.g. "Catapult" */
  name: string
  /** one-line description of what this integration does */
  description: string
  /** whether a base URL is relevant for this provider */
  usesBaseUrl: boolean
  baseUrlLabel?: string
  baseUrlPlaceholder?: string
  /** credential/config fields stored in `config` */
  fields: IntegrationField[]
}

/** Persisted connection config for one provider (server-side shape). */
export interface IntegrationConfig {
  provider: IntegrationProvider
  enabled: boolean
  baseUrl: string | null
  /** raw config jsonb — MAY contain secrets, server-only */
  config: Record<string, string>
}

/** Result of a `testConnection` call. */
export interface ConnectionTestResult {
  ok: boolean
  /** short human-readable status, safe to show in the admin UI */
  message: string
}

/**
 * The adapter contract every provider implements. `fetchX` methods are typed as
 * `unknown` return until real schemas land — callers narrow at the call site.
 */
export interface IntegrationAdapter {
  readonly provider: IntegrationProvider
  /** verifies the stored credentials can reach the vendor */
  testConnection(): Promise<ConnectionTestResult>
}

/** Thrown by every stub until real credentials/implementation exist. */
export class IntegrationNotConfiguredError extends Error {
  readonly provider: IntegrationProvider

  constructor(provider: IntegrationProvider, detail?: string) {
    super(
      detail ??
        `Integration "${provider}" is not configured yet. Add credentials in Admin → Integrations.`,
    )
    this.name = 'IntegrationNotConfiguredError'
    this.provider = provider
  }
}
