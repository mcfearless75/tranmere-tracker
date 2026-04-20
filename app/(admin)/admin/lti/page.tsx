import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateKeypair } from '@/lib/lti/keys'
import { headers } from 'next/headers'
import { LtiPlatformForm } from './LtiPlatformForm'

export const dynamic = 'force-dynamic'

export default async function LtiSetupPage() {
  const supabase = createAdminClient()

  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const base = `${proto}://${host}`

  let keypair: { kid: string } | null = null
  let platforms: any[] = []
  let migrationNeeded = false
  try {
    keypair = await getOrCreateKeypair()
    const { data } = await supabase.from('lti_platforms').select('*').order('created_at')
    platforms = data ?? []
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')) {
      migrationNeeded = true
    } else {
      throw err
    }
  }

  if (migrationNeeded || !keypair) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Moodle / LTI 1.3 Setup</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
          <p className="font-semibold text-amber-800">⚠️ Database migration needed</p>
          <p className="text-sm text-amber-700">Run this in your Supabase SQL Editor:</p>
          <code className="block text-xs bg-amber-100 p-2 rounded font-mono">supabase/migrations/010_lti_platforms.sql</code>
          <p className="text-xs text-amber-600">Creates <code>lti_platforms</code>, <code>lti_user_links</code>, and <code>lti_keypair</code> tables, then refresh this page.</p>
        </div>
      </div>
    )
  }

  const urls = {
    initiateLogin: `${base}/api/lti/login`,
    redirect:      `${base}/api/lti/launch`,
    jwks:          `${base}/api/lti/jwks`,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Moodle / LTI 1.3 Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register Tranmere Tracker as an External Tool inside Moodle (or any LTI 1.3 LMS).
          Single sign-on, grade passback, and deep linking all supported.
        </p>
      </div>

      {/* Tool URLs */}
      <div className="rounded-2xl border bg-white p-5 space-y-3">
        <h2 className="font-semibold">1. Tool URLs — paste these into Moodle</h2>
        <p className="text-xs text-muted-foreground">
          In Moodle: <strong>Site Administration → Plugins → External Tools → Manage tools → Configure a tool manually</strong>.
        </p>
        <UrlRow label="Tool URL / Redirect URI" value={urls.redirect} />
        <UrlRow label="Initiate Login URL" value={urls.initiateLogin} />
        <UrlRow label="Public keyset (JWKS) URL" value={urls.jwks} />
        <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
          <div>
            <p className="font-medium text-muted-foreground">Tool name</p>
            <p className="font-mono">Tranmere Tracker</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">LTI version</p>
            <p className="font-mono">LTI 1.3</p>
          </div>
          <div className="col-span-2">
            <p className="font-medium text-muted-foreground">Services to enable</p>
            <p className="font-mono">IMS LTI Assignment and Grade Services · IMS LTI Names and Role Provisioning · Tool Settings</p>
          </div>
        </div>
      </div>

      {/* Keypair display */}
      <div className="rounded-2xl border bg-white p-5 space-y-2">
        <h2 className="font-semibold">Tool public key</h2>
        <p className="text-xs text-muted-foreground">
          Auto-generated on first use. Moodle fetches this via the JWKS URL above — you don&apos;t normally need to paste it manually.
        </p>
        <p className="text-xs font-mono break-all bg-gray-50 rounded p-2">kid: {keypair.kid}</p>
      </div>

      {/* Platforms list + form */}
      <div className="rounded-2xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold">2. Register the platform (Moodle instance)</h2>
        <p className="text-xs text-muted-foreground">
          After Moodle finishes setting up the tool, it will give you: Platform ID (issuer), Client ID, Public keyset URL,
          Access token URL, Authentication request URL, and one or more Deployment IDs.
          Paste them here so Tranmere Tracker trusts this Moodle.
        </p>
        <LtiPlatformForm existing={platforms ?? []} />
      </div>

      {/* Cheat sheet */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm space-y-2">
        <p className="font-semibold text-tranmere-blue">⚡ Demo talk-track for the meeting</p>
        <ol className="list-decimal list-inside text-blue-900 space-y-1">
          <li>&ldquo;We support the open <strong>LTI 1.3</strong> standard used by Moodle, Canvas, Blackboard, Brightspace.&rdquo;</li>
          <li>&ldquo;Your Moodle admin pastes three URLs into Moodle&apos;s External Tools settings — 10 minute setup.&rdquo;</li>
          <li>&ldquo;Once that&apos;s done, teachers embed Tranmere Tracker links in any BTEC course page.&rdquo;</li>
          <li>&ldquo;Students click the link → auto-signed in with their college Moodle account, no separate login.&rdquo;</li>
          <li>&ldquo;When a coach grades work in Tranmere Tracker, the grade writes back to the Moodle gradebook automatically.&rdquo;</li>
        </ol>
      </div>
    </div>
  )
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2 mt-0.5">
        <input
          readOnly
          value={value}
          className="flex-1 font-mono text-xs border rounded-lg px-2 py-1.5 bg-gray-50"
          onClick={e => (e.target as HTMLInputElement).select()}
        />
      </div>
    </div>
  )
}
