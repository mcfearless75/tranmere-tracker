import { getPublicJWKS } from '@/lib/lti/keys'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const jwks = await getPublicJWKS()
  return NextResponse.json(jwks, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
