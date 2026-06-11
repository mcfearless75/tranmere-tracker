export type InstallPlatform = 'ios' | 'android' | 'other'

/** localStorage key marking that this device has seen the one-time install guide. */
export const INSTALL_GUIDE_SEEN_KEY = 'tt-install-guide-seen'

/** Detect the install platform from a user-agent string. */
export function detectPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase()
  // iPadOS 13+ reports as Macintosh but has touch — callers pass maxTouchPoints.
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'other'
}

/** iPadOS 13+ masquerades as desktop Safari; detect via touch points. */
export function isIpadOs(userAgent: string, maxTouchPoints: number): boolean {
  return /macintosh/.test(userAgent.toLowerCase()) && maxTouchPoints > 1
}

export interface InstallGuideContext {
  platform: InstallPlatform
  isStandalone: boolean
  isNativeApp: boolean
  hasSeenGuide: boolean
}

/**
 * The one-time guide auto-opens only when it can actually help:
 * a mobile browser, not already installed, not the native app, not seen before.
 */
export function shouldAutoShowGuide(ctx: InstallGuideContext): boolean {
  if (ctx.isStandalone || ctx.isNativeApp || ctx.hasSeenGuide) return false
  return ctx.platform === 'ios' || ctx.platform === 'android'
}

/** The manual "Install app" button is hidden where installing is impossible/already done. */
export function canOfferInstall(ctx: Pick<InstallGuideContext, 'platform' | 'isStandalone' | 'isNativeApp'>): boolean {
  if (ctx.isStandalone || ctx.isNativeApp) return false
  return ctx.platform === 'ios' || ctx.platform === 'android'
}
