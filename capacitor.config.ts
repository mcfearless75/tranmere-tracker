import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tranmererovers.tracker',
  appName: 'Tranmere Tracker',
  // webDir is unused in live-reload / remote-URL mode but required by the schema
  webDir: 'out',
  server: {
    // Point the WebView at the live Vercel deployment.
    // For local dev swap this to your ngrok / local IP URL.
    url: 'https://tranmeretracker.vercel.app',
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
