import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// LTI 1.3 OIDC Login Initiation
// The platform (Moodle) POSTs or GETs here when a user clicks the tool link.
// We redirect back to the platform's auth endpoint with state + nonce.
async function handle(req: NextRequest) {
  const params = req.method === 'GET'
    ? Object.fromEntries(req.nextUrl.searchParams)
    : Object.fromEntries(await req.formData()) as any

  const iss = params.iss as string
  const loginHint = params.login_hint as string
  const targetLinkUri = params.target_link_uri as string
  const ltiMessageHint = params.lti_message_hint as string | undefined
  const clientIdParam = params.client_id as string | undefined

  if (!iss || !loginHint || !targetLinkUri) {
    return NextResponse.json({ error: 'Missing required LTI params (iss, login_hint, target_link_uri)' }, { status: 400 })
  }

  // Look up the registered platform by issuer (and client_id if supplied)
  const supabase = createAdminClient()
  let query = supabase.from('lti_platforms').select('*').eq('issuer', iss)
  if (clientIdParam) query = query.eq('client_id', clientIdParam)
  const { data: platforms } = await query
  const platform = platforms?.[0]

  if (!platform) {
    return NextResponse.json({
      error: `Unknown LTI issuer: ${iss}. Register this platform at /admin/lti first.`,
    }, { status: 400 })
  }

  const state = randomBytes(16).toString('hex')
  const nonce = randomBytes(16).toString('hex')

  // Redirect to the platform's auth endpoint
  const authUrl = new URL(platform.auth_login_url)
  authUrl.searchParams.set('scope', 'openid')
  authUrl.searchParams.set('response_type', 'id_token')
  authUrl.searchParams.set('response_mode', 'form_post')
  authUrl.searchParams.set('prompt', 'none')
  authUrl.searchParams.set('client_id', platform.client_id)
  authUrl.searchParams.set('redirect_uri', targetLinkUri)
  authUrl.searchParams.set('login_hint', loginHint)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('nonce', nonce)
  if (ltiMessageHint) authUrl.searchParams.set('lti_message_hint', ltiMessageHint)

  const response = NextResponse.redirect(authUrl.toString(), 302)
  // Set state + nonce cookies so we can validate on the launch callback
  response.cookies.set('lti_state', state, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 600, path: '/' })
  response.cookies.set('lti_nonce', nonce, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 600, path: '/' })
  return response
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
