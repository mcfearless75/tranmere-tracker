const defaultRuntimeCaching = require('next-pwa/cache')

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['push-worker.js'],
  buildExcludes: [/^app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        (request.mode === 'navigate' ||
          request.headers.get('RSC') === '1' ||
          request.headers.get('Next-Router-Prefetch') === '1' ||
          url.searchParams.has('_rsc')),
      handler: 'NetworkOnly',
    },
    ...defaultRuntimeCaching.filter(
      entry => entry.options?.cacheName !== 'apis' && entry.options?.cacheName !== 'others',
    ),
  ],
  dynamicStartUrl: false,
  cacheStartUrl: false,
  reloadOnOnline: false,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [{ hostname: 'upload.wikimedia.org' }],
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@capacitor/core',
      '@capacitor/geolocation',
      '@capacitor/push-notifications',
      '@capacitor/android',
      '@capacitor/ios',
      '@capacitor-community/background-geolocation',
    ],
  },
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
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
