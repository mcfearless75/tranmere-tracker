/**
 * Native platform detection helpers.
 *
 * Safe to import in client components — all functions return false on the server
 * (SSR) or in a plain web browser. Only returns true inside a Capacitor WebView
 * (iOS / Android native build).
 */

/** True only inside a Capacitor native WebView (iOS or Android). */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false
  // Capacitor injects window.Capacitor when running in a native shell.
  return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.()
}

/** Returns 'ios' | 'android' | 'web'. */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor
  const p = cap?.getPlatform?.()
  if (p === 'ios') return 'ios'
  if (p === 'android') return 'android'
  return 'web'
}

export function isIos(): boolean {
  return getPlatform() === 'ios'
}

export function isAndroid(): boolean {
  return getPlatform() === 'android'
}
