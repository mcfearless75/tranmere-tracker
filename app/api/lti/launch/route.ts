import { createAdminClient } from '@/lib/supabase/admin'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// LTI 1.3 Launch — Moodle POSTs the signed id_token here after OIDC auth.
// We verify the JWT, extract claims, link the user, sign them in, redirect.
export async function POST(req: NextRequest) {
  const form = Object.fromEntries(await req.formData()) as any
  const idToken = form.id_token as string
  const state = form.state as string

  if (!idToken) return bad('Missing id_token')

  const stateCookie = req.cookies.get('lti_state')?.value
  if (stateCookie && state && stateCookie !== state) {
    return bad('State mismatch — possible CSRF')
  }

  const supabase = createAdminClient()

  // Decode header to grab kid (we need issuer to pick platform first — decode payload unverified then verify)
  let unverifiedPayload: any
  try {
    const [, payloadB64] = idToken.split('.')
    unverifiedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return bad('Malformed id_token')
  }

  const iss = unverifiedPayload.iss
  const aud = Array.isArray(unverifiedPayload.aud) ? unverifiedPayload.aud[0] : unverifiedPayload.aud

  const { data: platform } = await supabase
    .from('lti_platforms')
    .select('*')
    .eq('issuer', iss)
    .eq('client_id', aud)
    .maybeSingle()

  if (!platform) return bad(`No registered platform for issuer "${iss}"`)

  // Verify signature against the platform's JWKS
  const JWKS = createRemoteJWKSet(new URL(platform.keyset_url))
  let verified: any
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: platform.issuer,
      audience: platform.client_id,
    })
    verified = payload
  } catch (err: any) {
    return bad(`JWT verification failed: ${err.message}`)
  }

  // Validate nonce
  const nonceCookie = req.cookies.get('lti_nonce')?.value
  if (nonceCookie && verified.nonce && nonceCookie !== verified.nonce) {
    return bad('Nonce mismatch')
  }

  // Extract LTI claims
  const sub = String(verified.sub)
  const name = verified.name || verified['given_name'] || verified.email || 'LTI user'
  const email = verified.email as string | undefined
  const roles: string[] = verified['https://purl.imsglobal.org/spec/lti/claim/roles'] || []
  const targetLinkUri = verified['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'] as string | undefined

  // Determine role: instructor/admin → staff, else student
  const isStaffRole = roles.some(r => /Instructor|Administrator|ContentDeveloper|Mentor|Faculty|Staff/i.test(r))

  // Link or create user
  const { data: existingLink } = await supabase
    .from('lti_user_links')
    .select('user_id')
    .eq('platform_id', platform.id)
    .eq('lti_sub', sub)
    .maybeSingle()

  let userId = existingLink?.user_id
  let isNew = false

  if (!userId) {
    // Create a Supabase auth user + profile linked to the LTI sub
    const internalEmail = email ?? `lti-${sub}@${platform.issuer.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '-')}.internal`
    // Random long password (user never types this — they arrive via LTI session cookie)
    const randomPassword = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')

    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { full_name: name, source: 'lti', platform: platform.name },
    })
    if (authErr || !created?.user) return bad(`Could not create user: ${authErr?.message}`)

    await supabase.from('users').upsert({
      id: created.user.id,
      email: internalEmail,
      name,
      role: isStaffRole ? 'teacher' : 'student',
    })

    await supabase.from('lti_user_links').insert({
      platform_id: platform.id,
      lti_sub: sub,
      lti_email: email ?? null,
      lti_name: name,
      user_id: created.user.id,
      roles,
    })
    userId = created.user.id
    isNew = true
  }

  // Issue a magic-link-style session by signing in as the LTI user via admin client.
  const { data: userRow } = await supabase.from('users').select('email').eq('id', userId).single()
  const userEmail = userRow?.email ?? ''
  if (!userEmail) return bad('Could not resolve user email for session')

  // Where to land after auth — prefer dashboard over the raw launch URL
  const dest = isStaffRole ? '/admin/dashboard' : '/dashboard'

  // Derive site URL from request so it works on any Vercel preview or custom domain
  const siteUrl = req.nextUrl.origin

  const { data: session, error: sessErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userEmail,
    options: { redirectTo: `${siteUrl}${dest}` },
  })
  if (sessErr || !session) return bad(`Could not create session: ${sessErr?.message}`)

  const redirect = NextResponse.redirect(session.properties.action_link, 302)
  redirect.cookies.set('lti_launch_new', isNew ? '1' : '0', { maxAge: 60, path: '/' })
  return redirect
}

function bad(msg: string) {
  return new NextResponse(`<html><body style="font-family:system-ui;padding:2rem;background:#fee"><h1>LTI launch failed</h1><p>${msg}</p></body></html>`, {
    status: 400,
    headers: { 'content-type': 'text/html' },
  })
}
