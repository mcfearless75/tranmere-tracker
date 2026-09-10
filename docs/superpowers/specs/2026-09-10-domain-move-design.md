# Domain move to app.thesolarcampus.com — design (2026-09-10)

## Problem
Check-in stickers (QR via a QRCodeGeneratorHub dynamic link `o2o.to/i/BA31S0E7O8WK`, and an NFC tag) send students to `tranmeretracker.vercel.app`. Logins, location permission and push permission are per-origin, so students carry two logins and, for 25 of them, a permanently remembered "Don't Allow" for location on the old origin. The native Capacitor shells installed in May also point at the old origin (2 Android devices, no iOS registrations).

## Decisions (agreed with Paul)
- The QR company edits the dynamic link's destination to `https://app.thesolarcampus.com/attendance?tag=<token>` after 16:00 London today. No reprint.
- Stickers first, redirect later: the web redirect ships now but scoped to `/attendance` links only; it widens to every path a few school days later once check-in data shows most students on the new domain.
- Native builds get the new domain (already in `capacitor.config.ts`), the second Universal Link host, and the missing camera permissions. Paul triggers Codemagic `ios-release` and `android-release`.
- A login-page notice explains the one-off re-login to students arriving from a sticker.
- An admin sticker panel shows the canonical link and a QR so NFC tags and any future card can be programmed without guessing.

## Components

### 1. Canonical-host redirect — `lib/middleware/canonicalHost.ts` + `middleware.ts`
Pure function `canonicalRedirectTarget({ host, pathname, search }, config)` returns the absolute target or `null`. Config from env at request time (so it can change without a code deploy):

| Env | Default | Meaning |
|---|---|---|
| `CANONICAL_HOST` | `app.thesolarcampus.com` | where to send people |
| `LEGACY_HOSTS` | `tranmeretracker.vercel.app` | comma list; exact match only, so preview URLs never redirect |
| `CANONICAL_REDIRECT_PATHS` | `/attendance` | comma list of path prefixes, or `all` |
| `DISABLE_CANONICAL_REDIRECT` | unset | `1` switches it off |

Never redirected: `/api/*` (Vercel crons call the deployment host with a bearer token), `/.well-known/*` (Apple/Google fetch app-link files from the old host for installed builds), `/_next/*`. The redirect is a 308 to the same path and query plus `moved=1`, issued before any auth work in the middleware. Phase 2 is `CANONICAL_REDIRECT_PATHS=all` (or a one-line default change).

### 2. Login notice — `lib/auth/loginNotice.ts`, `components/auth/CheckInLoginNotice.tsx`, `app/(auth)/login/page.tsx`
`describeLoginContext(next)` → `{ checkIn, moved }`: `checkIn` when `next` is `/attendance` with a `tag`, `moved` when it carries `moved=1`. The notice reads: "Checking in? Log in once with your usual username and PIN, then tap Allow when your phone asks for location." With `moved`, it prefixes "We've moved to app.thesolarcampus.com."

### 3. Sticker panel — `lib/attendance/stickerUrl.ts`, `components/attendance/StickerPanel.tsx`, `SettingsForm.tsx`
`stickerUrl(token)` = `https://app.thesolarcampus.com/attendance?tag=<token>` (no tracking params). Panel renders inside the existing admin-only NFC token card once the token is revealed: the URL, a QR (client-side via `qrcode`), Copy and Download PNG buttons.

### 4. Native config (needs a Codemagic build)
- `ios/App/App/App.entitlements`: add `applinks:app.thesolarcampus.com`, keep the old entry.
- `ios/App/App/Info.plist`: `NSCameraUsageDescription`.
- `android/app/src/main/AndroidManifest.xml`: second `<data android:host="app.thesolarcampus.com" …/>` in the attendance intent filter; `android.permission.CAMERA`.
- Versions: Android `versionCode 4`, `versionName "1.3"`; iOS `MARKETING_VERSION 1.3`. Codemagic runs `cap sync`, so `capacitor.config.ts` flows through.

## Testing
Unit tests for `canonicalRedirectTarget` (hosts, ports, exclusions, prefixes, `all`, disabled), `describeLoginContext`, `stickerUrl`; component tests for the notice and the panel (qrcode mocked). Live checks after deploy: old-host `/attendance?tag=x` → 308 to new host; old-host `/dashboard` → not redirected (phase 1); `/.well-known/apple-app-site-association` and `assetlinks.json` served as JSON on both hosts; old-host `/api/…` untouched.

## Rollout
1. Deploy (phase 1 redirect live). 2. 16:00 QR company flips the dynamic link; Paul rewrites/repoints the NFC tag. 3. Paul triggers Codemagic builds; Android AAB to Play, iOS to TestFlight. 4. After a few school days, widen the redirect to all paths.

## Out of scope
Cookie migration between origins, removing the old Universal Link host, PIN flows, the "Don't forget to logout" card wording.
