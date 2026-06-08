/**
 * Provider registry — the single source of truth for which integrations exist,
 * what fields they need, and how to build their adapter. The admin UI renders
 * from `PROVIDER_LIST`; the API/server code resolves adapters via `getAdapter`.
 */

import {
  IntegrationAdapter,
  IntegrationConfig,
  IntegrationProvider,
  IntegrationProviderMeta,
} from './types'
import {
  CatapultAdapter,
  GuruAdapter,
  MoodleAdapter,
  SportsSessionPlannerAdapter,
  VeoAdapter,
} from './adapters'

export const PROVIDER_META: Record<IntegrationProvider, IntegrationProviderMeta> = {
  moodle: {
    provider: 'moodle',
    name: 'Moodle (REST)',
    description:
      'Pull grades and course data via the Moodle Web Services REST API. (SSO uses the separate LTI 1.3 setup.)',
    usesBaseUrl: true,
    baseUrlLabel: 'Moodle site URL',
    baseUrlPlaceholder: 'https://moodle.college.ac.uk',
    fields: [{ key: 'token', label: 'Web Services Token', secret: true, placeholder: 'wstoken' }],
  },
  veo: {
    provider: 'veo',
    name: 'VEO',
    description: 'Sync recorded matches and analysis clips from VEO Cam.',
    usesBaseUrl: false,
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'veo_…' }],
  },
  catapult: {
    provider: 'catapult',
    name: 'Catapult',
    description: 'Import GPS load and athlete monitoring data from Catapult.',
    usesBaseUrl: false,
    fields: [
      { key: 'apiToken', label: 'API Token', secret: true, placeholder: 'token' },
      { key: 'orgId', label: 'Organisation ID', secret: false, placeholder: 'org_…' },
    ],
  },
  guru: {
    provider: 'guru',
    name: 'GURU',
    description: 'Pull biomechanics and performance assessments from GURU.',
    usesBaseUrl: false,
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'guru_…' }],
  },
  sports_session_planner: {
    provider: 'sports_session_planner',
    name: 'Sports Session Planner',
    description: 'Import planned training sessions and drills.',
    usesBaseUrl: false,
    fields: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: 'ssp_…' }],
  },
}

/** Ordered list for rendering the admin UI. */
export const PROVIDER_LIST: IntegrationProviderMeta[] = [
  PROVIDER_META.moodle,
  PROVIDER_META.veo,
  PROVIDER_META.catapult,
  PROVIDER_META.guru,
  PROVIDER_META.sports_session_planner,
]

/** Every valid provider id, for runtime validation at system boundaries. */
export const PROVIDERS: IntegrationProvider[] = PROVIDER_LIST.map((p) => p.provider)

/** Type guard for untrusted input (request bodies). */
export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return typeof value === 'string' && (PROVIDERS as string[]).includes(value)
}

type AdapterFactory = (config: IntegrationConfig) => IntegrationAdapter

const ADAPTER_FACTORIES: Record<IntegrationProvider, AdapterFactory> = {
  moodle: (c) => new MoodleAdapter(c),
  veo: (c) => new VeoAdapter(c),
  catapult: (c) => new CatapultAdapter(c),
  guru: (c) => new GuruAdapter(c),
  sports_session_planner: (c) => new SportsSessionPlannerAdapter(c),
}

/** Resolve the adapter instance for a stored config. */
export function getAdapter(config: IntegrationConfig): IntegrationAdapter {
  const factory = ADAPTER_FACTORIES[config.provider]
  if (!factory) {
    throw new Error(`No adapter registered for provider "${config.provider}"`)
  }
  return factory(config)
}
