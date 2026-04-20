import { generateKeyPair, exportJWK, exportPKCS8, importPKCS8 } from 'jose'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

/**
 * Lazily generates (and persists) a single RSA keypair for signing LTI
 * client assertions and publishing the JWKS endpoint.
 */
export async function getOrCreateKeypair() {
  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('lti_keypair').select('*').eq('id', 1).maybeSingle()
  if (existing) return existing as { kid: string; public_jwk: any; private_pem: string }

  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const publicJwk = await exportJWK(publicKey)
  const kid = randomUUID()
  publicJwk.kid = kid
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  const privatePem = await exportPKCS8(privateKey as any)

  await supabase.from('lti_keypair').insert({ id: 1, kid, public_jwk: publicJwk, private_pem: privatePem })
  return { kid, public_jwk: publicJwk, private_pem: privatePem }
}

export async function getPrivateKey() {
  const kp = await getOrCreateKeypair()
  const key = await importPKCS8(kp.private_pem, 'RS256')
  return { key, kid: kp.kid }
}

export async function getPublicJWKS() {
  const kp = await getOrCreateKeypair()
  return { keys: [kp.public_jwk] }
}
