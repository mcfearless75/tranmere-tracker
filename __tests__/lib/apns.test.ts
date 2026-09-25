import { generateKeyPairSync, createVerify } from 'crypto'
import { isApnsToken, buildApnsJwt, sendApnsBatch } from '@/lib/apns'

describe('isApnsToken', () => {
  it('matches a 64-hex APNs device token', () => {
    expect(isApnsToken('a'.repeat(64))).toBe(true)
    expect(isApnsToken('0123456789ABCDEF'.repeat(4))).toBe(true)
  })

  it('does not match an FCM registration token', () => {
    expect(isApnsToken('dXk3:APA91b' + 'x'.repeat(130))).toBe(false)
    expect(isApnsToken('a'.repeat(63))).toBe(false)
  })
})

describe('buildApnsJwt', () => {
  it('produces an ES256 JWT that verifies against the key', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const jwt = buildApnsJwt({ key: pem, keyId: 'KEY123', teamId: 'TEAM99' }, 1700000000)
    const [h, c, sig] = jwt.split('.')

    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY123' })
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({ iss: 'TEAM99', iat: 1700000000 })

    const v = createVerify('SHA256')
    v.update(`${h}.${c}`)
    expect(v.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true)
  })
})

describe('sendApnsBatch', () => {
  it('reports every token as failed (without connecting) when APNs is not configured', async () => {
    delete process.env.APNS_KEY_P8
    delete process.env.APNS_KEY_ID
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(sendApnsBatch(['a'.repeat(64)], { title: 't', body: 'b' })).resolves.toEqual({ sent: 0, failed: 1 })
    warn.mockRestore()
  })

  it('is a no-op for an empty list', async () => {
    await expect(sendApnsBatch([], { title: 't', body: 'b' })).resolves.toEqual({ sent: 0, failed: 0 })
  })
})
