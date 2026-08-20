'use client'

/**
 * Ships a client-thrown error (caught by an error.tsx boundary) to the
 * server so it shows up in Vercel's runtime logs. React error boundaries
 * only run in the browser — nothing about them reaches server-side error
 * tracking on its own, so without this a boundary firing in production is
 * invisible to us beyond a user's screenshot. Best-effort; never throws.
 */
export function reportClientError(
  error: Error & { digest?: string },
  boundary: string,
): void {
  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boundary,
        message: error?.message ?? 'Unknown error',
        digest: error?.digest ?? null,
        stack: error?.stack ?? null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      keepalive: true,
    })
  } catch {
    // never let telemetry break the error page itself
  }
}
