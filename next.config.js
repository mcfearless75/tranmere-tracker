const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'upload.wikimedia.org' }],
  },
  // Capacitor packages reference native / DOM APIs — keep them out of the
  // server bundle so Next.js doesn't try to SSR-bundle native code.
  serverExternalPackages: [
    '@capacitor/core',
    '@capacitor/geolocation',
    '@capacitor/push-notifications',
    '@capacitor/android',
    '@capacitor/ios',
    '@capacitor-community/background-geolocation',
  ],
  // iOS Universal Links: Apple requires the AASA file served as application/json.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
