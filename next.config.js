const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerSrc: 'sw-push.js',
  customWorkerDest: 'public',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'upload.wikimedia.org' }],
  },
}

module.exports = withPWA(nextConfig)
