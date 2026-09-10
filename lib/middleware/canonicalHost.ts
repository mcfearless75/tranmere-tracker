/**
 * Canonical-host redirect: tranmeretracker.vercel.app → app.thesolarcampus.com.
 *
 * Why this lives in middleware and not next.config.js `redirects()`: the
 * config is read from env at REQUEST time, so the redirect can be widened
 * (phase 2: every path) or switched off without a code change or rebuild.
 *
 * Why it is scoped to /attendance first: the check-in stickers are what
 * bring students to the old host, and a sticker tap is the one moment a
 * one-off re-login is painless (staff present, PIN typed most mornings
 * anyway). Old dashboard bookmarks keep working untouched until phase 2.
 *
 * Pure — no next/server import — so it is unit-testable in jsdom.
 */

export type CanonicalConfig = {
  canonicalHost: string
  /** Exact hostnames (no port) that should be redirected. */
  legacyHosts: string[]
  /** Path prefixes to redirect, or 'all'. */
  paths: string[] | 'all'
  disabled: boolean
}

export const DEFAULT_CANONICAL_HOST = 'app.thesolarcampus.com'
export const DEFAULT_LEGACY_HOSTS = ['tranmeretracker.vercel.app']
export const DEFAULT_REDIRECT_PATHS = ['/attendance']

/** Paths that must keep answering on the old host. */
const NEVER_REDIRECT_PREFIXES = [
  // Vercel crons hit the deployment host with a bearer token a redirect drops.
  '/api/',
  // Apple/Google fetch app-link files from the host in the installed build.
  '/.well-known/',
  '/_next/',
]

function splitList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined) return fallback
  const items = value.split(',').map(s => s.trim()).filter(Boolean)
  return items.length > 0 ? items : fallback
}

export function readCanonicalConfig(env: Record<string, string | undefined>): CanonicalConfig {
  const rawPaths = env.CANONICAL_REDIRECT_PATHS?.trim()
  const disabledRaw = env.DISABLE_CANONICAL_REDIRECT?.trim().toLowerCase()
  return {
    canonicalHost: (env.CANONICAL_HOST?.trim() || DEFAULT_CANONICAL_HOST).toLowerCase(),
    legacyHosts: splitList(env.LEGACY_HOSTS, DEFAULT_LEGACY_HOSTS).map(h => h.toLowerCase()),
    paths: rawPaths?.toLowerCase() === 'all' ? 'all' : splitList(rawPaths, DEFAULT_REDIRECT_PATHS),
    disabled: disabledRaw === '1' || disabledRaw === 'true',
  }
}

function hostnameOf(host: string | null | undefined): string | null {
  if (!host) return null
  const trimmed = host.trim().toLowerCase()
  if (!trimmed) return null
  // Strip a port (host headers can carry one). IPv6 literals are never a
  // legacy host, so a naive split is fine.
  return trimmed.startsWith('[') ? trimmed : trimmed.split(':')[0]
}

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')
}

/**
 * Absolute URL to redirect to, or null when this request should be served
 * as-is. Appends `moved=1` so the destination can explain the hop.
 */
export function canonicalRedirectTarget(
  request: { host: string | null | undefined; pathname: string; search: string },
  config: CanonicalConfig,
): string | null {
  if (config.disabled) return null
  const hostname = hostnameOf(request.host)
  if (!hostname || hostname === config.canonicalHost) return null
  if (!config.legacyHosts.includes(hostname)) return null

  const pathname = request.pathname || '/'
  if (NEVER_REDIRECT_PREFIXES.some(p => pathname.startsWith(p))) return null
  if (config.paths !== 'all' && !config.paths.some(p => pathMatches(pathname, p))) return null

  const url = new URL(pathname + (request.search || ''), `https://${config.canonicalHost}`)
  url.searchParams.set('moved', '1')
  return url.toString()
}
