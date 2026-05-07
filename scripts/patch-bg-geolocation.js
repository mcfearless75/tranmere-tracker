/**
 * Patch @capacitor-community/background-geolocation Package.swift to allow
 * capacitor-swift-pm 8.x. Upstream pins to "from: 7.0.0" which excludes 8.x.
 *
 * Runs as a postinstall hook so the patch applies on every npm install / npm ci.
 * No patch-package dependency (which is broken on Node 24).
 */
const fs = require('fs')
const path = require('path')

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capacitor-community',
  'background-geolocation',
  'Package.swift',
)

if (!fs.existsSync(file)) {
  console.log('[patch-bg-geolocation] plugin not installed, skipping')
  process.exit(0)
}

const original = fs.readFileSync(file, 'utf8')
const patched = original.replace(
  /from:\s*"7\.0\.0"/,
  '"7.0.0"..<"9.0.0"',
)

if (original === patched) {
  if (patched.includes('"7.0.0"..<"9.0.0"')) {
    console.log('[patch-bg-geolocation] already patched')
  } else {
    console.error('[patch-bg-geolocation] expected pattern not found — plugin may have updated')
    process.exit(1)
  }
} else {
  fs.writeFileSync(file, patched)
  console.log('[patch-bg-geolocation] patched capacitor-swift-pm version range to 7.0.0..<9.0.0')
}
