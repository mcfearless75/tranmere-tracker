import { toClientIntegration } from '@/lib/integrations/clientView'
import { IntegrationConfig } from '@/lib/integrations/types'

describe('toClientIntegration', () => {
  it('never returns secret values to the client', () => {
    const config: IntegrationConfig = {
      provider: 'moodle',
      enabled: true,
      baseUrl: 'https://moodle.test',
      config: { token: 'super-secret-token' },
    }
    const view = toClientIntegration(config)
    const tokenField = view.fields.find((f) => f.key === 'token')
    expect(tokenField).toBeDefined()
    expect(tokenField?.value).toBe('') // secret value stripped
    expect(tokenField?.hasValue).toBe(true) // but flagged as stored
    // the raw secret must not appear anywhere in the serialised view
    expect(JSON.stringify(view)).not.toContain('super-secret-token')
  })

  it('passes through non-secret values', () => {
    const config: IntegrationConfig = {
      provider: 'catapult',
      enabled: false,
      baseUrl: null,
      config: { orgId: 'org_123', apiToken: 'cat-token-should-be-stripped' },
    }
    const view = toClientIntegration(config)
    const orgField = view.fields.find((f) => f.key === 'orgId')
    expect(orgField?.value).toBe('org_123')
    expect(orgField?.hasValue).toBe(true)
    // the secret field's value is stripped and never serialised to the client
    const tokenField = view.fields.find((f) => f.key === 'apiToken')
    expect(tokenField?.value).toBe('')
    expect(JSON.stringify(view)).not.toContain('cat-token-should-be-stripped')
  })
})
