const defaultRuntimeCaching = require('next-pwa/cache')

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Adds the push/notificationclick handlers to the generated sw.js. This is
  // NOT automatic — public/push-worker.js (or its predecessor, worker/index.js)
  // was previously never referenced anywhere, so the deployed service worker
  // had no 'push' event listener at all: a fully working subscribe-and-send
  // pipeline still displayed nothing, silently, on every device.
  importScripts: ['push-worker.js'],
  // next-pwa 5.6 excludes the Pages Router build manifests (build-manifest.json,
  // react-loadable-manifest.json) from the precache list, but was never updated
  // for the App Router equivalent — app-build-manifest.json is a Next.js
  // internal build artifact that Vercel does not serve at runtime, so Workbox
  // precaching it 404s on every single install. Per the Service Worker spec, a
  // single failed precache fetch fails the WHOLE install — the SW never
  // reaches "activated", so navigator.serviceWorker.ready hangs forever and
  // every push subscription attempt times out. This has silently broken every
  // service worker install since the app moved to App Router.
  buildExcludes: [/^app-build-manifest\.json$/],
  // Never cache /api/* on device. next-pwa's default runtime caching includes
  // an "apis" NetworkFirst rule that persists authenticated API responses
  // (players' private data) in the service-worker cache for 24h — readable by
  // the next person on a shared device. The NetworkOnly rule below matches
  // first; the filtered defaults keep all static asset caching intact.
  runtimeCaching: [
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    ...defaultRuntimeCaching.filter(entry => entry.options?.cacheName !== 'apis'),
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'upload.wikimedia.org' }],
  },
  // Capacitor packages reference native / DOM APIs — keep them out of the
  // server bundle so Next.js doesn't try to SSR-bundle native code.
  // On Next 14 this is experimental.serverComponentsExternalPackages;
  // the bare serverExternalPackages key is Next 15 and is silently ignored here.
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
