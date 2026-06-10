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
      {
        // Security headers on every route. X-Frame-Options DENY blocks
        // clickjacking; the app is never legitimately framed.
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=()' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
