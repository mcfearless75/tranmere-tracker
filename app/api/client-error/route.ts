import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Receives errors caught by client-side error.tsx boundaries and logs them
 * server-side so they show up in Vercel's runtime logs — React error
 * boundaries are browser-only and otherwise leave zero server-side trace.
 * No auth required (a crash can happen before login); intentionally does
 * nothing but log — no storage, no PII beyond what the browser already sent.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      boundary?: string
      message?: string
      digest?: string | null
      stack?: string | null
      url?: string | null
      userAgent?: string | null
    }
    console.error(
      `[client-error] boundary=${body.boundary ?? 'unknown'} digest=${body.digest ?? '-'} url=${body.url ?? '-'}\n` +
      `  message: ${body.message ?? '-'}\n` +
      `  ua: ${body.userAgent ?? '-'}\n` +
      `  stack: ${body.stack ?? '-'}`
    )
  } catch {
    // malformed payload — nothing to log
  }
  return NextResponse.json({ ok: true })
}
