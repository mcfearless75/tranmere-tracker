/**
 * Maps a server-side IntegrationConfig to a client-safe shape. Secret field
 * values are NEVER sent to the browser — instead a boolean `hasValue` flag tells
 * the UI whether a credential is already stored. The masked sentinel is what the
 * client sends back unchanged to mean "keep the existing secret".
 */

import { IntegrationConfig, IntegrationProvider } from './types'
import { PROVIDER_META } from './providers'

/** Sentinel the client returns for an untouched secret field. */
export const SECRET_SENTINEL = '__UNCHANGED__'

export interface ClientIntegrationField {
  key: string
  label: string
  secret: boolean
  placeholder?: string
  /** for non-secret fields, the stored value; for secrets, always '' */
  value: string
  /** for secret fields: whether a value is already stored */
  hasValue: boolean
}

export interface ClientIntegration {
  provider: IntegrationProvider
  name: string
  description: string
  enabled: boolean
  usesBaseUrl: boolean
  baseUrlLabel?: string
  baseUrlPlaceholder?: string
  baseUrl: string
  fields: ClientIntegrationField[]
}

/** Build the masked, client-safe view of one provider's config. */
export function toClientIntegration(config: IntegrationConfig): ClientIntegration {
  const meta = PROVIDER_META[config.provider]
  return {
    provider: config.provider,
    name: meta.name,
    description: meta.description,
    enabled: config.enabled,
    usesBaseUrl: meta.usesBaseUrl,
    baseUrlLabel: meta.baseUrlLabel,
    baseUrlPlaceholder: meta.baseUrlPlaceholder,
    baseUrl: config.baseUrl ?? '',
    fields: meta.fields.map((field) => {
      const stored = (config.config[field.key] ?? '').trim()
      return {
        key: field.key,
        label: field.label,
        secret: field.secret,
        placeholder: field.placeholder,
        value: field.secret ? '' : stored,
        hasValue: stored !== '',
      }
    }),
  }
}
