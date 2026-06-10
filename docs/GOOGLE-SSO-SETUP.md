# Google Sign-In — Configuration Record

✅ **LIVE since 2026-06-11.** Google OAuth login is built (login-page button +
`/auth/callback` route) and fully configured. Restricted to the academy domains
for safeguarding: `tranmere.academy` and `tranmererovers.co.uk`
(see `lib/config/auth.ts`).

## What's configured where

### Google Cloud Console (Paul's paulmc18 account — NOT Tranmere's Workspace)
- Project: **educate** (`educate-492818`)
- OAuth client: **solar-campus-web** (Web application)
  - Client ID: `972945629498-3a3cnvp3hhea89lfdgnup85sibdtpmbk.apps.googleusercontent.com`
  - Authorised redirect URI: `https://avpdwutgtsurddvfxhmh.supabase.co/auth/v1/callback`
- Consent screen: **External, In production** (no Google verification needed —
  basic openid/email/profile scopes only). App name: **The Solar Campus**.
- Because the consent screen is External, Tranmere's Workspace was NOT required.
  If Tranmere's admin console blocks third-party apps, ask their IT to allowlist
  the client ID above (2-minute job) — that is the only possible blocker.

### Supabase (tranmeretracker project)
- Authentication → Sign In/Providers → **Google: Enabled** with the client ID +
  secret above (secret stored in Supabase only).
- URL Configuration → Redirect URLs include:
  - `https://tranmeretracker.vercel.app/**`
  - `https://app.thesolarcampus.com/**`

## How it behaves
- **Existing users** whose account email matches their Google email link
  automatically (verified email) and keep their role and data.
- **New academy users** get a `student` profile on first sign-in. Staff are
  promoted to coach/teacher by an admin in `/admin/users` after first login.
- **Anyone outside the allowed domains** is signed out and their auto-created
  account deleted in the callback — they cannot get in.

## Smoke test
A non-academy Google account (e.g. paulmc18@gmail.com) completing the Google
flow and landing back on /login with "That Google account is not permitted" is
the PASS condition — it proves the OAuth round-trip and the domain gate both work.

## ⚠️ Action needed for some existing students
11 students still have **placeholder `@tranmeretracker.internal` emails** (not
real Google addresses). Google login will NOT match them — it would create new
empty accounts and orphan their GPS/attendance history. Before they use Google
login, update their account email to their real `@tranmere.academy` address
(Supabase dashboard → Authentication → Users → edit, or
`admin.auth.admin.updateUserById`). Until then they keep using password / PIN
login. The 23 students already on `@tranmere.academy` are fine.

## To change the allowed domains
Edit `ALLOWED_EMAIL_DOMAINS` in `lib/config/auth.ts` and redeploy.

## Later (cosmetic)
Consent-screen branding verification (shows "The Solar Campus" name reliably)
needs a homepage + privacy policy + ToS link on thesolarcampus.com — submit via
Google Auth Platform → Branding once that site exists.
