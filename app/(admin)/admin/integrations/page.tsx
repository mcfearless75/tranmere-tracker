import { loadAllIntegrationConfigs } from '@/lib/integrations/store'
import { toClientIntegration } from '@/lib/integrations/clientView'
import { IntegrationCard } from '@/components/admin/integrations/IntegrationCard'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  let migrationNeeded = false
  let integrations: ReturnType<typeof toClientIntegration>[] = []

  try {
    const configs = await loadAllIntegrationConfigs()
    integrations = configs.map(toClientIntegration)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')) {
      migrationNeeded = true
    } else {
      throw err
    }
  }

  if (migrationNeeded) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Integrations</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
          <p className="font-semibold text-amber-800">⚠️ Database migration needed</p>
          <p className="text-sm text-amber-700">Run this in your Supabase SQL Editor:</p>
          <code className="block text-xs bg-amber-100 p-2 rounded font-mono">
            supabase/migrations/031_integrations.sql
          </code>
          <p className="text-xs text-amber-600">
            Creates the <code>integration_configs</code> table, then refresh this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external platforms. Each integration goes live the moment valid
          credentials are saved and the connection is enabled — paste keys here, no
          deploy needed.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
        Credentials are stored server-side only and never returned to the browser.
        Use <strong>Test connection</strong> to verify once keys are added.
      </div>

      <div className="grid grid-cols-1 gap-4">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.provider} integration={integration} />
        ))}
      </div>
    </div>
  )
}
