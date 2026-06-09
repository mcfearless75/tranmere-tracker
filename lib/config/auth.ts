/**
 * Google sign-in is restricted to the academy's Google Workspace domains for
 * safeguarding — only these email domains may authenticate via Google. Anyone
 * else is rejected (and their auto-created account removed) in the OAuth callback.
 *
 * TODO: confirm these are the correct/complete Google Workspace domains.
 */
export const ALLOWED_EMAIL_DOMAINS = ['tranmere.academy', 'tranmererovers.co.uk'] as const

/** True if the email belongs to one of the academy's permitted domains. */
export function isAllowedEmailDomain(email: string | null | undefined): boolean {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return false
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)
}
