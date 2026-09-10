/**
 * The one link every check-in sticker (NFC tag, QR card, dynamic-QR
 * destination) must carry. Canonical origin only, and no tracking params —
 * the utm_* noise the QR generator added was baked into every scan and
 * cluttered every log line while telling us nothing.
 */
export const CANONICAL_APP_ORIGIN = 'https://app.thesolarcampus.com'

export function stickerUrl(token: string, origin: string = CANONICAL_APP_ORIGIN): string {
  const url = new URL('/attendance', origin)
  url.searchParams.set('tag', token.trim())
  return url.toString()
}
