# Tranmere Tracker — Football Performance Platform

## What This Is
Next.js platform for tracking Tranmere Rovers player and match performance. Includes QR code scanning, push notifications, Claude AI integration, charts/analytics, and PWA support.

## Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3 + tailwind-merge + tw-animate-css
- **UI Components**: Base UI (headless)
- **Backend/Auth/DB**: Supabase (SSR client `@supabase/ssr`)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Charts**: Recharts
- **QR**: html5-qrcode
- **Push Notifications**: web-push
- **PWA**: next-pwa
- **Auth**: Supabase SSR with middleware (`middleware.ts`)
- **Tests**: Jest + Testing Library (`npm test`)
- **Deploy**: Vercel (inferred from stack)

## Commands
```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run start      # start production server
npm run lint       # ESLint (Next.js config)
npm test           # Jest (jsdom environment)
npm run test:watch # Jest watch mode
```

## Project Structure
```
app/           # Next.js App Router pages and layouts
components/    # shared React components
lib/           # utilities, Supabase client, helpers
__tests__/     # Jest test files
middleware.ts  # Supabase auth middleware (protects routes)
docs/          # documentation
```

## Key Rules
- ALWAYS use `@supabase/ssr` — never the plain `supabase-js` browser client directly (SSR requires cookie-based auth)
- Middleware handles auth session refresh — do not duplicate this logic
- Claude API calls must include prompt caching where applicable (reduces cost)
- All new features need Jest tests in `__tests__/`
- TypeScript strict — no `any` types without justification
- Components go in `components/`, not inline in page files

## Supabase SSR Pattern
```ts
import { createServerClient } from '@supabase/ssr'
// Use cookies() from next/headers in Server Components
// Use createBrowserClient for Client Components
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-side only
ANTHROPIC_API_KEY            # server-side only
VAPID_PUBLIC_KEY             # web push
VAPID_PRIVATE_KEY            # web push, server-side only
```

## Current State & Priorities
- Core match/player tracking working
- QR code check-in system implemented
- Push notifications wired up
- AI analysis via Claude API active
- Focus: test coverage, performance, mobile UX
