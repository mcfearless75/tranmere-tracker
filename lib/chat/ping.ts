'use client'

/**
 * A short two-note "ping" for a new chat message, synthesised with Web Audio
 * so there is no sound file to cache or 404.
 *
 * Browsers only let audio start after the user has interacted with the page,
 * so unlockPing() is bound to the first tap. A ping before that is silently
 * skipped, which is fine: the banner still shows.
 */

type AudioCtor = typeof AudioContext
let ctx: AudioContext | null = null

function getCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: AudioCtor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

/** Create/resume the audio context. Call from a user gesture. */
export function unlockPing(): void {
  try {
    const Ctor = getCtor()
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // Audio unavailable (old WebView, privacy mode): the banner still shows.
  }
}

export function playPing(): void {
  try {
    if (!ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    for (const [freq, start] of [[880, 0], [1320, 0.12]] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + 0.3)
    }
  } catch {
    // Never let a sound failure break message handling.
  }
}
