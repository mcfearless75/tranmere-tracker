# Tranmere Tracker

Student performance PWA for Tranmere Rovers / The Solar Campus — attendance
(NFC check-in + GPS geofencing), match/formation tracking, chat, wellbeing
check-ins, coursework, and admin/safeguarding tooling for staff.

**Live:**
- `https://app.thesolarcampus.com` — canonical
- `https://tranmeretracker.vercel.app` — legacy host, still referenced by some printed QR stickers

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS + Base UI ·
Supabase (Postgres, Auth via `@supabase/ssr`) · Anthropic Claude API ·
Recharts · Capacitor (iOS/Android WebView shells) · Vercel (hosting + cron) ·
Codemagic (native builds)

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
npm test              # Jest
npm run test:watch
npm run lint
npm run build
```

Environment variables (see `CLAUDE.md` for the full list — names only, no
secrets committed anywhere):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-side only
ANTHROPIC_API_KEY            # server-side only
VAPID_PUBLIC_KEY             # web push
VAPID_PRIVATE_KEY            # web push, server-side only
```

## Auth

Two separate login paths:
- **Students and staff** — Supabase Auth (`@supabase/ssr`, cookie-based session, enforced in `middleware.ts`).
- **Admin PIN login** (`/admin-login`) — a shared superuser account
  (`superuser@tranmeretracker.internal`) authenticated with a 5–7 digit PIN
  as the password. This account must never be deleted — see `CLAUDE.md` for
  recovery steps if it ever is.

## Native apps (Capacitor)

The iOS/Android apps are thin WebView shells pointed at the live production
URL (`capacitor.config.ts`) — they are **not** a bundled copy of this code.
A normal `git push` to `master` reaches every native install on next app
open, same as the web PWA. **Do not** trigger a Codemagic rebuild for
regular feature/UI/bug-fix work — only when native permissions, a Capacitor
plugin, app icons, or `android/`/`ios/`/`capacitor.config.ts` themselves
change. Full detail in `CLAUDE.md`.

## Further reading

- `CLAUDE.md` — project rules and conventions (read this first for any
  non-trivial change: Supabase patterns, cron rules, PIN/native-app gotchas)
- `docs/FEATURE-STATUS.md` — feature-by-feature build status
- `docs/SESSION-HANDOFF.md` — most recent working-session snapshot
- `docs/CRON-SCHEDULES.md` — Vercel cron schedules, London time ↔ UTC
- `docs/deep-dive-2026-09-10.md` — known issues and root-cause notes
