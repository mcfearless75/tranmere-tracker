/**
 * Concrete adapter implementations.
 *
 * Each adapter is constructed with its stored `IntegrationConfig`. While the
 * provider is disabled or missing required credentials, every method throws
 * `IntegrationNotConfiguredError`. Real vendor HTTP calls slot directly into the
 * marked TODO blocks once credentials are available — the public surface does
 * not change, so call sites and the registry stay untouched.
 */

import {
  ConnectionTestResult,
  IntegrationAdapter,
  IntegrationConfig,
  IntegrationNotConfiguredError,
  IntegrationProvider,
} from './types'
import { PROVIDER_META } from './providers'

/** Returns the config keys that must be present (non-empty) for a provider. */
function requiredKeysFor(provider: IntegrationProvider): string[] {
  const meta = PROVIDER_META[provider]
  return meta.fields.map((f) => f.key)
}

/**
 * True when the provider is enabled and every required field plus (if relevant)
 * the base URL has a non-empty value.
 */
export function isConfigured(config: IntegrationConfig): boolean {
  if (!config.enabled) return false

  const meta = PROVIDER_META[config.provider]
  if (meta.usesBaseUrl && !config.baseUrl?.trim()) return false

  return requiredKeysFor(config.provider).every(
    (key) => (config.config[key] ?? '').trim() !== '',
  )
}

/** Base adapter — guards every call behind the configured check. */
abstract class BaseAdapter implements IntegrationAdapter {
  readonly provider: IntegrationProvider
  protected readonly config: IntegrationConfig

  constructor(config: IntegrationConfig) {
    this.provider = config.provider
    this.config = config
  }

  protected ensureConfigured(): void {
    if (!isConfigured(this.config)) {
      throw new IntegrationNotConfiguredError(this.provider)
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!isConfigured(this.config)) {
      return {
        ok: false,
        message: 'Not configured — add credentials and enable to connect.',
      }
    }
    // TODO: replace with a real lightweight vendor "ping" once creds exist.
    return {
      ok: false,
      message:
        'Credentials saved, but live vendor calls are not implemented yet.',
    }
  }
}

/** Moodle LMS (note: LTI 1.3 SSO lives in lib/lti — this is REST/token access). */
export class MoodleAdapter extends BaseAdapter {
  /** Fetch graded activities for a course (stub). */
  async fetchGrades(_courseId: string): Promise<unknown> {
    this.ensureConfigured()
    throw new IntegrationNotConfiguredError(this.provider, 'fetchGrades not implemented')
  }
}

/** VEO video analysis. */
export class VeoAdapter extends BaseAdapter {
  /** Fetch recorded matches / clips (stub). */
  async fetchRecordings(): Promise<unknown> {
    this.ensureConfigured()
    throw new IntegrationNotConfiguredError(this.provider, 'fetchRecordings not implemented')
  }
}

/** Catapult GPS / athlete monitoring. */
export class CatapultAdapter extends BaseAdapter {
  /** Fetch GPS activity data for an athlete (stub). */
  async fetchActivities(_athleteId: string): Promise<unknown> {
    this.ensureConfigured()
    throw new IntegrationNotConfiguredError(this.provider, 'fetchActivities not implemented')
  }
}

/** GURU performance / biomechanics. */
export class GuruAdapter extends BaseAdapter {
  /** Fetch assessment sessions (stub). */
  async fetchSessions(): Promise<unknown> {
    this.ensureConfigured()
    throw new IntegrationNotConfiguredError(this.provider, 'fetchSessions not implemented')
  }
}

/** Sports Session Planner. */
export class SportsSessionPlannerAdapter extends BaseAdapter {
  /** Fetch planned training sessions (stub). */
  async fetchPlans(): Promise<unknown> {
    this.ensureConfigured()
    throw new IntegrationNotConfiguredError(this.provider, 'fetchPlans not implemented')
  }
}
