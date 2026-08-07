import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison for secrets (PINs, cron secrets, tokens).
 *
 * - Fails closed: returns false when either side is missing, empty, or not a
 *   string — so an unset env secret can never compare equal to anything.
 * - Length guard: crypto.timingSafeEqual throws on unequal lengths, so we
 *   compare lengths first. This leaks only the secret's length, not content.
 *
 * Node runtime only (uses node:crypto) — not for Edge routes.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length === 0 || b.length === 0) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Structural subset of Request so this stays testable without a fetch polyfill. */
type HeaderCarrier = { headers: { get(name: string): string | null } }

/**
 * Verifies the `Authorization: Bearer <CRON_SECRET>` header on a cron request.
 * Fails closed when CRON_SECRET is unset and compares in constant time.
 */
export function verifyCronSecret(request: HeaderCarrier): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)
}
