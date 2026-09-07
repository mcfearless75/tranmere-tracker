import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tranmererovers.tracker',
  appName: 'Tranmere Tracker',
  // webDir is unused in live-reload / remote-URL mode but required by the schema
  webDir: 'out',
  server: {
    // Canonical domain (2026-09-07) — was tranmeretracker.vercel.app.
    // IMPORTANT: this only takes effect on the NEXT native build. Anyone on
    // an already-installed build is still hardcoded to the old URL — if that
    // old URL starts redirecting (next.config.js) before those installs are
    // updated, their WebView follows the redirect to a different origin and
    // loses its session cookie (cookies don't carry across origins), logging
    // them out with no warning. Sequence this as: ship a new native build
    // first, let it roll out, THEN turn on the web redirect — not both at once.
    // For local dev swap this to your ngrok / local IP URL.
    url: 'https://app.thesolarcampus.com',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    BackgroundGeolocation: {
      backgroundMessage:
        'Tranmere Tracker is verifying your location for training attendance.',
      backgroundTitle: 'Location Active',
      requestPermissions: true,
      stale: false,
      distanceFilter: 50,
    },
  },
}

export default config
