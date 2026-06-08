import {
  PROVIDERS,
  PROVIDER_LIST,
  PROVIDER_META,
  isIntegrationProvider,
  getAdapter,
} from '@/lib/integrations/providers'
import { isConfigured } from '@/lib/integrations/adapters'
import {
  IntegrationConfig,
  IntegrationNotConfiguredError,
  IntegrationProvider,
} from '@/lib/integrations/types'
import { MoodleAdapter, CatapultAdapter } from '@/lib/integrations/adapters'

function configFor(
  provider: IntegrationProvider,
  overrides: Partial<IntegrationConfig> = {},
): IntegrationConfig {
  return {
    provider,
    enabled: false,
    baseUrl: null,
    config: {},
    ...overrides,
  }
}

describe('integration provider registry', () => {
  it('lists all five expected providers', () => {
    expect(PROVIDERS).toEqual([
      'moodle',
      'veo',
      'catapult',
      'guru',
      'sports_session_planner',
    ])
  })

  it('has metadata for every provider in the list', () => {
    for (const provider of PROVIDERS) {
      expect(PROVIDER_META[provider]).toBeDefined()
      expect(PROVIDER_META[provider].provider).toBe(provider)
    }
    expect(PROVIDER_LIST).toHaveLength(PROVIDERS.length)
  })

  it('validates provider ids from untrusted input', () => {
    expect(isIntegrationProvider('moodle')).toBe(true)
    expect(isIntegrationProvider('unknown')).toBe(false)
    expect(isIntegrationProvider(42)).toBe(false)
    expect(isIntegrationProvider(null)).toBe(false)
  })

  it('resolves a typed adapter for each provider', () => {
    for (const provider of PROVIDERS) {
      const adapter = getAdapter(configFor(provider))
      expect(adapter.provider).toBe(provider)
      expect(typeof adapter.testConnection).toBe('function')
    }
  })
})

describe('isConfigured', () => {
  it('is false when the provider is disabled', () => {
    expect(isConfigured(configFor('veo', { config: { apiKey: 'x' } }))).toBe(false)
  })

  it('is false when required base URL is missing', () => {
    expect(
      isConfigured(configFor('moodle', { enabled: true, config: { token: 'abc' } })),
    ).toBe(false)
  })

  it('is false when a required credential is blank', () => {
    expect(
      isConfigured(configFor('catapult', { enabled: true, config: { apiToken: ' ', orgId: 'o' } })),
    ).toBe(false)
  })

  it('is true when enabled with all required fields populated', () => {
    expect(
      isConfigured(
        configFor('moodle', {
          enabled: true,
          baseUrl: 'https://moodle.test',
          config: { token: 'abc' },
        }),
      ),
    ).toBe(true)
  })
})

describe('adapter stubs', () => {
  it('testConnection reports not configured when disabled', async () => {
    const result = await getAdapter(configFor('veo')).testConnection()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not configured/i)
  })

  it('fetch stubs throw IntegrationNotConfiguredError until creds exist', async () => {
    const moodle = new MoodleAdapter(configFor('moodle'))
    await expect(moodle.fetchGrades('1')).rejects.toBeInstanceOf(
      IntegrationNotConfiguredError,
    )

    const catapult = new CatapultAdapter(configFor('catapult'))
    await expect(catapult.fetchActivities('a1')).rejects.toBeInstanceOf(
      IntegrationNotConfiguredError,
    )
  })
})
