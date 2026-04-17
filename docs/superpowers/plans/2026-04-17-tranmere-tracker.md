# Tranmere Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA for Tranmere Rovers FC academy students to track BTEC coursework, nutrition, training, and match performance, with a full admin panel for coaches and staff.

**Architecture:** Next.js 14 App Router PWA backed by Supabase (Postgres + Auth + Edge Functions). Role-based routing via Next.js middleware with Row Level Security on all tables. Barcode scanning via html5-qrcode, food data from Open Food Facts API, Web Push for deadline notifications.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase (`@supabase/ssr`), next-pwa, html5-qrcode, web-push, Jest, React Testing Library

---

## File Structure

```
tranmeretracker/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # redirects based on role
│   ├── (auth)/
│   │   └── login/
│   │       ├── page.tsx
│   │       └── actions.ts
│   ├── (student)/
│   │   ├── layout.tsx                    # bottom nav shell
│   │   ├── dashboard/page.tsx
│   │   ├── coursework/page.tsx
│   │   ├── nutrition/
│   │   │   ├── page.tsx
│   │   │   └── scan/page.tsx
│   │   ├── training/page.tsx
│   │   ├── matches/page.tsx
│   │   └── profile/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx                    # sidebar shell
│   │   └── admin/
│   │       ├── users/page.tsx
│   │       ├── courses/page.tsx
│   │       ├── assignments/page.tsx
│   │       ├── notifications/page.tsx
│   │       └── reports/page.tsx
│   └── api/
│       ├── food/search/route.ts          # Open Food Facts proxy
│       ├── push/subscribe/route.ts
│       └── push/send/route.ts
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx
│   │   └── AdminSidebar.tsx
│   ├── coursework/
│   │   ├── AssignmentCard.tsx
│   │   └── SubmissionStatusBadge.tsx
│   ├── nutrition/
│   │   ├── MacroProgress.tsx
│   │   ├── FoodSearchInput.tsx
│   │   ├── BarcodeScanner.tsx
│   │   └── MealLogForm.tsx
│   ├── training/
│   │   ├── TrainingLogForm.tsx
│   │   └── TrainingList.tsx
│   ├── matches/
│   │   ├── MatchLogForm.tsx
│   │   └── MatchList.tsx
│   └── admin/
│       ├── UserTable.tsx
│       └── NotificationForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── openFoodFacts.ts
│   ├── webpush.ts
│   └── utils.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── public/
│   ├── manifest.json
│   └── sw-push.js                        # push event handler
├── middleware.ts
├── next.config.js
├── jest.config.ts
└── jest.setup.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd "C:\Users\LAPTOP80\Desktop\_Apps_Code\ALL APPS\tranmeretracker"
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr next-pwa html5-qrcode web-push
npm install -D @types/web-push
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn-ui@latest init
```
When prompted: TypeScript=yes, style=Default, base color=Slate, CSS variables=yes, tailwind config=tailwind.config.ts, components=`@/components/ui`, utils=`@/lib/utils`, RSC=yes, no test files.

Then add components used throughout the app:
```bash
npx shadcn-ui@latest add button card input label badge progress select textarea dialog table
```

- [ ] **Step 4: Install test dependencies**

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 5: Create `jest.config.ts`**

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}

export default createJestConfig(config)
```

- [ ] **Step 6: Create `jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Configure `next.config.js` for PWA**

```js
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
}

module.exports = withPWA(nextConfig)
```

- [ ] **Step 8: Add Tranmere brand colors to `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tranmere: {
          blue: '#003087',
          gold: '#D4AF37',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

- [ ] **Step 9: Run dev server to confirm scaffold works**

```bash
npm run dev
```
Expected: App running at http://localhost:3000, no errors in console.

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 PWA with Supabase deps and Tranmere brand"
```

---

## Task 2: Supabase Schema & Client

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`
- Create: `.env.local`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com → New project → name it `tranmere-tracker`. Copy the Project URL and anon key.

- [ ] **Step 2: Create `.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY=  # filled in Task 13
VAPID_PRIVATE_KEY= # filled in Task 13
VAPID_SUBJECT=mailto:paulmc18@gmail.com
```

- [ ] **Step 3: Write migration — `supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Courses
create table courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null
);

insert into courses (name) values
  ('Level 2 Public Services / Fitness'),
  ('Level 3 Sports Science'),
  ('Level 3 Sports Coaching');

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('student', 'coach', 'admin')),
  course_id uuid references courses(id),
  avatar_url text,
  created_at timestamptz default now()
);

-- BTEC Units
create table btec_units (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references courses(id),
  unit_number text not null,
  unit_name text not null
);

-- Assignments
create table assignments (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references btec_units(id),
  title text not null,
  description text,
  due_date date not null,
  grade_target text check (grade_target in ('Pass', 'Merit', 'Distinction')),
  created_at timestamptz default now()
);

-- Submissions
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references assignments(id),
  student_id uuid not null references public.users(id),
  status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','graded')),
  grade text,
  feedback text,
  submitted_at timestamptz,
  unique(assignment_id, student_id)
);

-- Nutrition goals
create table nutrition_goals (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id) unique,
  calories int not null default 2500,
  protein_g int not null default 150,
  carbs_g int not null default 300,
  fat_g int not null default 80,
  set_by uuid references public.users(id)
);

-- Nutrition logs
create table nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id),
  logged_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name text not null,
  barcode text,
  calories int not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  created_at timestamptz default now()
);

-- Training logs
create table training_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id),
  session_date date not null default current_date,
  session_type text not null,
  duration_mins int not null,
  intensity text not null check (intensity in ('low','medium','high')),
  notes text,
  created_at timestamptz default now()
);

-- Match logs
create table match_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.users(id),
  match_date date not null,
  opponent text not null,
  goals int not null default 0,
  assists int not null default 0,
  minutes_played int not null,
  position text,
  self_rating int check (self_rating between 1 and 10),
  notes text,
  created_at timestamptz default now()
);

-- Push subscriptions
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- Row Level Security
alter table public.users enable row level security;
alter table submissions enable row level security;
alter table nutrition_goals enable row level security;
alter table nutrition_logs enable row level security;
alter table training_logs enable row level security;
alter table match_logs enable row level security;
alter table push_subscriptions enable row level security;

-- Users: read own row; admin/coach read all
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_select_admin" on public.users for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Submissions: student owns their own
create policy "submissions_student" on submissions for all using (auth.uid() = student_id);
create policy "submissions_admin" on submissions for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Nutrition logs: student owns
create policy "nutrition_logs_own" on nutrition_logs for all using (auth.uid() = student_id);
create policy "nutrition_logs_coach" on nutrition_logs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Nutrition goals: coach sets, student reads
create policy "nutrition_goals_read" on nutrition_goals for select using (
  auth.uid() = student_id or
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);
create policy "nutrition_goals_write" on nutrition_goals for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Training/match: student owns, coach reads
create policy "training_own" on training_logs for all using (auth.uid() = student_id);
create policy "training_coach" on training_logs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);
create policy "match_own" on match_logs for all using (auth.uid() = student_id);
create policy "match_coach" on match_logs for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','coach'))
);

-- Push subscriptions: own only
create policy "push_own" on push_subscriptions for all using (auth.uid() = user_id);

-- Trigger: auto-create public.users row on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), coalesce(new.raw_user_meta_data->>'role','student'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 4: Run migration in Supabase SQL editor**

Copy the contents of `001_initial_schema.sql` into the Supabase dashboard → SQL Editor → Run.
Expected: "Success. No rows returned."

- [ ] **Step 5: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 7: Write test for client creation**

Create `__tests__/lib/supabase.test.ts`:

```ts
describe('supabase client', () => {
  it('createClient returns an object with from() method', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    const { createClient } = await import('@/lib/supabase/client')
    const client = createClient()
    expect(typeof client.from).toBe('function')
  })
})
```

- [ ] **Step 8: Run test**

```bash
npx jest __tests__/lib/supabase.test.ts
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: supabase schema, migrations, and typed client setup"
```

---

## Task 3: Authentication & Middleware

**Files:**
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`
- Create: `app/page.tsx`

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Redirect unauthenticated users to login
  if (!user && !path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from login
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Guard admin routes
  if (path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user!.id)
      .single()

    if (!profile || !['admin', 'coach'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
```

- [ ] **Step 2: Create `app/(auth)/login/actions.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 3: Create `app/(auth)/login/page.tsx`**

```tsx
import { signIn } from './actions'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-tranmere-blue p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
            alt="Tranmere Rovers FC"
            width={80}
            height={80}
            priority
          />
          <h1 className="text-2xl font-bold text-tranmere-blue">Tranmere Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <form action={signIn} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-tranmere-blue text-white py-2 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/page.tsx` (role-based redirect)**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin' || profile?.role === 'coach') {
    redirect('/admin/users')
  }

  redirect('/dashboard')
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: auth middleware, login page, and role-based redirects"
```

---

## Task 4: PWA Configuration & Branding

**Files:**
- Create: `public/manifest.json`
- Create: `app/layout.tsx`

- [ ] **Step 1: Download PWA icons**

Download the Tranmere Rovers crest and save as PWA icons. Run:

```bash
mkdir -p public/icons
curl -o public/icons/icon-192.png "https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/192px-Tranmere_Rovers_FC_crest.svg.png"
curl -o public/icons/icon-512.png "https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/512px-Tranmere_Rovers_FC_crest.svg.png"
```

- [ ] **Step 2: Create `public/manifest.json`**

```json
{
  "name": "Tranmere Tracker",
  "short_name": "TRTracker",
  "description": "Tranmere Rovers FC student performance tracker",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#003087",
  "theme_color": "#003087",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Update `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tranmere Tracker',
  description: 'Tranmere Rovers FC student performance tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TRTracker',
  },
}

export const viewport: Viewport = {
  themeColor: '#003087',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: PWA manifest, icons, and layout metadata"
```

---

## Task 5: Student Shell & Dashboard

**Files:**
- Create: `components/layout/BottomNav.tsx`
- Create: `app/(student)/layout.tsx`
- Create: `app/(student)/dashboard/page.tsx`

- [ ] **Step 1: Create `components/layout/BottomNav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Apple, Dumbbell, Trophy } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/coursework', label: 'BTEC', icon: BookOpen },
  { href: '/nutrition', label: 'Food', icon: Apple },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/matches', label: 'Matches', icon: Trophy },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-lg mx-auto">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active ? 'text-tranmere-blue' : 'text-gray-400'}`}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Create `app/(student)/layout.tsx`**

```tsx
import { BottomNav } from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative">
      <main className="pb-20 px-4 pt-4">{children}</main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(student)/dashboard/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('name, course_id, courses(name)')
    .eq('id', user!.id)
    .single()

  // Upcoming assignments (due within 14 days)
  const { data: upcoming } = await supabase
    .from('assignments')
    .select('id, title, due_date, btec_units(course_id)')
    .gte('due_date', new Date().toISOString().split('T')[0])
    .lte('due_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])
    .order('due_date')
    .limit(3)

  // Today's nutrition total
  const today = new Date().toISOString().split('T')[0]
  const { data: todayFood } = await supabase
    .from('nutrition_logs')
    .select('calories')
    .eq('student_id', user!.id)
    .eq('logged_date', today)

  const totalCalories = todayFood?.reduce((sum, r) => sum + r.calories, 0) ?? 0

  // Latest training
  const { data: lastTraining } = await supabase
    .from('training_logs')
    .select('session_type, session_date, duration_mins')
    .eq('student_id', user!.id)
    .order('session_date', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 py-2">
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={40}
          height={40}
        />
        <div>
          <h1 className="text-lg font-bold text-tranmere-blue">Hi, {profile?.name?.split(' ')[0]}</h1>
          <p className="text-xs text-muted-foreground">{(profile?.courses as any)?.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming?.length ? upcoming.map(a => (
            <Link key={a.id} href="/coursework" className="flex justify-between items-center text-sm">
              <span className="font-medium truncate">{a.title}</span>
              <span className="text-muted-foreground ml-2 shrink-0">{new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            </Link>
          )) : <p className="text-sm text-muted-foreground">No deadlines in the next 14 days</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Today's calories</p>
            <p className="text-2xl font-bold text-tranmere-blue">{totalCalories}</p>
            <Link href="/nutrition" className="text-xs text-tranmere-blue underline">Log food</Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Last session</p>
            {lastTraining ? (
              <>
                <p className="text-sm font-bold">{lastTraining.session_type}</p>
                <p className="text-xs text-muted-foreground">{lastTraining.duration_mins} mins</p>
              </>
            ) : <p className="text-sm text-muted-foreground">None logged</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: student shell with bottom nav and dashboard widgets"
```

---

## Task 6: Coursework Tracker

**Files:**
- Create: `components/coursework/AssignmentCard.tsx`
- Create: `app/(student)/coursework/page.tsx`

- [ ] **Step 1: Write test for status label helper**

Create `__tests__/lib/utils.test.ts`:

```ts
import { getStatusLabel, getStatusColor } from '@/lib/utils'

describe('submission status helpers', () => {
  it('returns correct label for each status', () => {
    expect(getStatusLabel('not_started')).toBe('Not Started')
    expect(getStatusLabel('in_progress')).toBe('In Progress')
    expect(getStatusLabel('submitted')).toBe('Submitted')
    expect(getStatusLabel('graded')).toBe('Graded')
  })

  it('returns a non-empty color class for each status', () => {
    for (const s of ['not_started','in_progress','submitted','graded'] as const) {
      expect(getStatusColor(s).length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx jest __tests__/lib/utils.test.ts
```
Expected: FAIL — `getStatusLabel` not exported from `@/lib/utils`

- [ ] **Step 3: Add helpers to `lib/utils.ts`**

The file will already have shadcn's `cn` helper. Append:

```ts
export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded'

export function getStatusLabel(status: SubmissionStatus): string {
  const map: Record<SubmissionStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    graded: 'Graded',
  }
  return map[status]
}

export function getStatusColor(status: SubmissionStatus): string {
  const map: Record<SubmissionStatus, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-blue-100 text-blue-700',
    graded: 'bg-green-100 text-green-700',
  }
  return map[status]
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npx jest __tests__/lib/utils.test.ts
```
Expected: PASS

- [ ] **Step 5: Create `components/coursework/AssignmentCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { getStatusLabel, getStatusColor, type SubmissionStatus } from '@/lib/utils'

type Props = {
  assignmentId: string
  studentId: string
  title: string
  unitName: string
  dueDate: string
  gradeTarget: string | null
  status: SubmissionStatus
  grade: string | null
  feedback: string | null
}

export function AssignmentCard({ assignmentId, studentId, title, unitName, dueDate, gradeTarget, status, grade, feedback }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const supabase = createClient()
  const daysUntil = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)

  async function updateStatus(newStatus: SubmissionStatus) {
    await supabase.from('submissions').upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      status: newStatus,
      submitted_at: newStatus === 'submitted' ? new Date().toISOString() : null,
    })
    setCurrentStatus(newStatus)
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{unitName}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(currentStatus)}`}>
            {getStatusLabel(currentStatus)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Due: {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {daysUntil <= 7 && daysUntil >= 0 && (
            <Badge variant="destructive" className="text-xs">{daysUntil === 0 ? 'Due today!' : `${daysUntil}d left`}</Badge>
          )}
          {gradeTarget && <span>Target: {gradeTarget}</span>}
        </div>
        {grade && <p className="text-xs font-medium text-green-700">Grade: {grade}</p>}
        {feedback && <p className="text-xs text-muted-foreground italic">"{feedback}"</p>}
        {currentStatus !== 'graded' && (
          <select
            value={currentStatus}
            onChange={e => updateStatus(e.target.value as SubmissionStatus)}
            className="w-full text-xs border rounded px-2 py-1 mt-1"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
          </select>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Create `app/(student)/coursework/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { AssignmentCard } from '@/components/coursework/AssignmentCard'

export default async function CourseworkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('course_id')
    .eq('id', user!.id)
    .single()

  // Get all assignments for student's course via btec_units
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id, title, due_date, grade_target,
      btec_units(id, unit_name, course_id)
    `)
    .order('due_date')

  // Filter to student's course
  const courseAssignments = assignments?.filter(
    a => (a.btec_units as any)?.course_id === profile?.course_id
  ) ?? []

  // Get existing submissions for this student
  const { data: submissions } = await supabase
    .from('submissions')
    .select('assignment_id, status, grade, feedback')
    .eq('student_id', user!.id)

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, s])
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">BTEC Coursework</h1>
      {courseAssignments.length === 0 && (
        <p className="text-sm text-muted-foreground">No assignments yet.</p>
      )}
      {courseAssignments.map(a => {
        const sub = submissionMap[a.id]
        return (
          <AssignmentCard
            key={a.id}
            assignmentId={a.id}
            studentId={user!.id}
            title={a.title}
            unitName={(a.btec_units as any)?.unit_name ?? ''}
            dueDate={a.due_date}
            gradeTarget={a.grade_target}
            status={sub?.status ?? 'not_started'}
            grade={sub?.grade ?? null}
            feedback={sub?.feedback ?? null}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: BTEC coursework tracker with status updates"
```

---

## Task 7: Nutrition — Food Search & Barcode

**Files:**
- Create: `lib/openFoodFacts.ts`
- Create: `app/api/food/search/route.ts`
- Create: `components/nutrition/FoodSearchInput.tsx`
- Create: `components/nutrition/BarcodeScanner.tsx`

- [ ] **Step 1: Write test for Open Food Facts parser**

Create `__tests__/lib/openFoodFacts.test.ts`:

```ts
import { parseFoodItem } from '@/lib/openFoodFacts'

describe('parseFoodItem', () => {
  it('extracts macros from Open Food Facts product', () => {
    const product = {
      product_name: 'Chicken Breast',
      nutriments: {
        'energy-kcal_100g': 165,
        protein_100g: 31,
        carbohydrates_100g: 0,
        fat_100g: 3.6,
      },
    }
    const result = parseFoodItem(product, 100)
    expect(result.food_name).toBe('Chicken Breast')
    expect(result.calories).toBe(165)
    expect(result.protein_g).toBe(31)
    expect(result.carbs_g).toBe(0)
    expect(result.fat_g).toBeCloseTo(3.6)
  })

  it('scales macros by serving size', () => {
    const product = {
      product_name: 'Rice',
      nutriments: { 'energy-kcal_100g': 130, protein_100g: 2.7, carbohydrates_100g: 28, fat_100g: 0.3 },
    }
    const result = parseFoodItem(product, 200)
    expect(result.calories).toBe(260)
    expect(result.carbs_g).toBe(56)
  })
})
```

- [ ] **Step 2: Run test — confirm fails**

```bash
npx jest __tests__/lib/openFoodFacts.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `lib/openFoodFacts.ts`**

```ts
export type FoodItem = {
  food_name: string
  barcode: string | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export function parseFoodItem(product: any, servingGrams: number): FoodItem {
  const factor = servingGrams / 100
  return {
    food_name: product.product_name ?? 'Unknown',
    barcode: product.code ?? null,
    calories: Math.round((product.nutriments?.['energy-kcal_100g'] ?? 0) * factor),
    protein_g: Math.round((product.nutriments?.protein_100g ?? 0) * factor * 10) / 10,
    carbs_g: Math.round((product.nutriments?.carbohydrates_100g ?? 0) * factor * 10) / 10,
    fat_g: Math.round((product.nutriments?.fat_100g ?? 0) * factor * 10) / 10,
  }
}

export async function searchFood(query: string): Promise<any[]> {
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`
  )
  const data = await res.json()
  return data.products ?? []
}

export async function lookupBarcode(barcode: string): Promise<any | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
  const data = await res.json()
  return data.status === 1 ? data.product : null
}
```

- [ ] **Step 4: Run test — confirm passes**

```bash
npx jest __tests__/lib/openFoodFacts.test.ts
```
Expected: PASS

- [ ] **Step 5: Create `app/api/food/search/route.ts`**

```ts
import { searchFood, lookupBarcode } from '@/lib/openFoodFacts'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const barcode = searchParams.get('barcode')

  if (barcode) {
    const product = await lookupBarcode(barcode)
    return NextResponse.json(product ? [product] : [])
  }

  if (!query) return NextResponse.json([])
  const products = await searchFood(query)
  return NextResponse.json(products.slice(0, 10))
}
```

- [ ] **Step 6: Create `components/nutrition/FoodSearchInput.tsx`**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { parseFoodItem, type FoodItem } from '@/lib/openFoodFacts'

type Props = { onSelect: (item: FoodItem) => void }

export function FoodSearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setResults(data)
    setLoading(false)
  }, [])

  return (
    <div className="relative">
      <Input
        placeholder="Search food (e.g. chicken breast)..."
        value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value) }}
      />
      {loading && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
      {results.length > 0 && (
        <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map((product, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
              onClick={() => {
                onSelect(parseFoodItem(product, 100))
                setQuery(product.product_name ?? '')
                setResults([])
              }}
            >
              <span className="font-medium">{product.product_name}</span>
              <span className="text-muted-foreground text-xs ml-2">
                {Math.round(product.nutriments?.['energy-kcal_100g'] ?? 0)} kcal/100g
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create `components/nutrition/BarcodeScanner.tsx`**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { parseFoodItem, type FoodItem } from '@/lib/openFoodFacts'

type Props = { onResult: (item: FoodItem) => void; onClose: () => void }

export function BarcodeScanner({ onResult, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let scanner: any
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner('barcode-reader', { fps: 10, qrbox: 250 }, false)
      scanner.render(async (barcode: string) => {
        scanner.clear()
        const res = await fetch(`/api/food/search?barcode=${barcode}`)
        const products = await res.json()
        if (products[0]) onResult(parseFoodItem(products[0], 100))
        else alert('Product not found in database')
        onClose()
      }, () => {})
    })
    return () => { scanner?.clear().catch(() => {}) }
  }, [onResult, onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Scan Barcode</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>
        <div id="barcode-reader" ref={ref} />
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: nutrition food search and barcode scanner"
```

---

## Task 8: Nutrition — Meal Log & Macro Display

**Files:**
- Create: `components/nutrition/MacroProgress.tsx`
- Create: `components/nutrition/MealLogForm.tsx`
- Create: `app/(student)/nutrition/page.tsx`

- [ ] **Step 1: Write test for macro totals calculation**

Create `__tests__/lib/macros.test.ts`:

```ts
import { sumMacros } from '@/lib/utils'

describe('sumMacros', () => {
  it('sums nutrition log entries', () => {
    const logs = [
      { calories: 400, protein_g: 30, carbs_g: 50, fat_g: 10 },
      { calories: 200, protein_g: 15, carbs_g: 20, fat_g: 5 },
    ]
    const result = sumMacros(logs)
    expect(result.calories).toBe(600)
    expect(result.protein_g).toBe(45)
    expect(result.carbs_g).toBe(70)
    expect(result.fat_g).toBe(15)
  })

  it('returns zeros for empty array', () => {
    const result = sumMacros([])
    expect(result.calories).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — confirm fails**

```bash
npx jest __tests__/lib/macros.test.ts
```

- [ ] **Step 3: Add `sumMacros` to `lib/utils.ts`**

```ts
type MacroEntry = { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export function sumMacros(logs: MacroEntry[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein_g: acc.protein_g + Number(l.protein_g),
      carbs_g: acc.carbs_g + Number(l.carbs_g),
      fat_g: acc.fat_g + Number(l.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}
```

- [ ] **Step 4: Run test — confirm passes**

```bash
npx jest __tests__/lib/macros.test.ts
```

- [ ] **Step 5: Create `components/nutrition/MacroProgress.tsx`**

```tsx
import { Progress } from '@/components/ui/progress'

type Props = {
  label: string
  current: number
  target: number
  unit: string
  color?: string
}

export function MacroProgress({ label, current, target, unit, color = 'bg-tranmere-blue' }: Props) {
  const pct = Math.min(Math.round((current / target) * 100), 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span>{current}{unit} / {target}{unit}</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  )
}
```

- [ ] **Step 6: Create `components/nutrition/MealLogForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FoodSearchInput } from './FoodSearchInput'
import { BarcodeScanner } from './BarcodeScanner'
import type { FoodItem } from '@/lib/openFoodFacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = { studentId: string; onLogged: () => void }

export function MealLogForm({ studentId, onLogged }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [grams, setGrams] = useState('100')
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch')
  const [showScanner, setShowScanner] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleSelect(item: FoodItem) {
    setSelected(item)
    setGrams('100')
  }

  function scaled(val: number) {
    return Math.round((val * Number(grams)) / 100 * 10) / 10
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    await supabase.from('nutrition_logs').insert({
      student_id: studentId,
      logged_date: new Date().toISOString().split('T')[0],
      meal_type: meal,
      food_name: selected.food_name,
      barcode: selected.barcode,
      calories: scaled(selected.calories),
      protein_g: scaled(selected.protein_g),
      carbs_g: scaled(selected.carbs_g),
      fat_g: scaled(selected.fat_g),
    })
    setSelected(null)
    setSaving(false)
    onLogged()
  }

  return (
    <div className="space-y-3 bg-white rounded-xl border p-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <FoodSearchInput onSelect={handleSelect} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowScanner(true)}>Scan</Button>
      </div>
      {showScanner && (
        <BarcodeScanner onResult={item => { handleSelect(item); setShowScanner(false) }} onClose={() => setShowScanner(false)} />
      )}
      {selected && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{selected.food_name}</p>
          <div className="flex gap-2 items-center">
            <Input type="number" value={grams} onChange={e => setGrams(e.target.value)} className="w-20" min="1" />
            <span className="text-sm text-muted-foreground">g</span>
            <span className="text-sm text-muted-foreground ml-2">{scaled(selected.calories)} kcal · {scaled(selected.protein_g)}g protein</span>
          </div>
          <select value={meal} onChange={e => setMeal(e.target.value as any)} className="w-full text-sm border rounded px-2 py-1">
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <Button onClick={handleSave} disabled={saving} className="w-full bg-tranmere-blue">
            {saving ? 'Saving...' : 'Add to log'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create `app/(student)/nutrition/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { MacroProgress } from '@/components/nutrition/MacroProgress'
import { MealLogForm } from '@/components/nutrition/MealLogForm'
import { sumMacros } from '@/lib/utils'

export default async function NutritionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: logs }, { data: goals }] = await Promise.all([
    supabase.from('nutrition_logs').select('*').eq('student_id', user!.id).eq('logged_date', today).order('created_at'),
    supabase.from('nutrition_goals').select('*').eq('student_id', user!.id).single(),
  ])

  const totals = sumMacros(logs ?? [])
  const targets = goals ?? { calories: 2500, protein_g: 150, carbs_g: 300, fat_g: 80 }

  const byMeal = (meal: string) => (logs ?? []).filter(l => l.meal_type === meal)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Nutrition</h1>
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <MacroProgress label="Calories" current={totals.calories} target={targets.calories} unit=" kcal" />
        <MacroProgress label="Protein" current={totals.protein_g} target={targets.protein_g} unit="g" />
        <MacroProgress label="Carbs" current={totals.carbs_g} target={targets.carbs_g} unit="g" />
        <MacroProgress label="Fat" current={totals.fat_g} target={targets.fat_g} unit="g" />
      </div>
      <MealLogForm studentId={user!.id} onLogged={() => {}} />
      {['breakfast','lunch','dinner','snack'].map(meal => {
        const items = byMeal(meal)
        if (!items.length) return null
        return (
          <div key={meal} className="bg-white rounded-xl border p-3">
            <h3 className="text-sm font-semibold capitalize mb-2">{meal}</h3>
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                <span>{item.food_name}</span>
                <span className="text-muted-foreground">{item.calories} kcal</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: nutrition meal log with macro progress bars"
```

---

## Task 9: Training Tracker

**Files:**
- Create: `components/training/TrainingLogForm.tsx`
- Create: `app/(student)/training/page.tsx`

- [ ] **Step 1: Create `components/training/TrainingLogForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const SESSION_TYPES = ['Gym', 'Pitch Session', 'Cardio', 'Recovery', 'Match Preparation', 'Strength & Conditioning']

type Props = { studentId: string; onSaved: () => void }

export function TrainingLogForm({ studentId, onSaved }: Props) {
  const supabase = createClient()
  const [type, setType] = useState('Gym')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!duration) return
    setSaving(true)
    await supabase.from('training_logs').insert({
      student_id: studentId,
      session_date: date,
      session_type: type,
      duration_mins: Number(duration),
      intensity,
      notes: notes || null,
    })
    setDuration(''); setNotes('')
    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold text-sm">Log Session</h2>
      <select value={type} onChange={e => setType(e.target.value)} className="w-full text-sm border rounded px-2 py-2">
        {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input type="number" placeholder="Duration (mins)" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
      </div>
      <div className="flex gap-2">
        {(['low','medium','high'] as const).map(i => (
          <button key={i} onClick={() => setIntensity(i)}
            className={`flex-1 text-xs py-1.5 rounded-lg border font-medium capitalize ${intensity === i ? 'bg-tranmere-blue text-white border-tranmere-blue' : 'bg-white text-gray-600'}`}>
            {i}
          </button>
        ))}
      </div>
      <Textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      <Button onClick={handleSave} disabled={saving || !duration} className="w-full bg-tranmere-blue">
        {saving ? 'Saving...' : 'Log Session'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(student)/training/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { TrainingLogForm } from '@/components/training/TrainingLogForm'

export default async function TrainingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('training_logs')
    .select('*')
    .eq('student_id', user!.id)
    .order('session_date', { ascending: false })
    .limit(20)

  const intensityColor = { low: 'text-green-600', medium: 'text-yellow-600', high: 'text-red-600' }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Training</h1>
      <TrainingLogForm studentId={user!.id} onSaved={() => {}} />
      <div className="space-y-2">
        {sessions?.map(s => (
          <div key={s.id} className="bg-white rounded-xl border p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold">{s.session_type}</p>
              <p className="text-xs text-muted-foreground">{new Date(s.session_date).toLocaleDateString('en-GB')} · {s.duration_mins} mins</p>
              {s.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{s.notes}</p>}
            </div>
            <span className={`text-xs font-semibold capitalize ${intensityColor[s.intensity as keyof typeof intensityColor]}`}>{s.intensity}</span>
          </div>
        ))}
        {!sessions?.length && <p className="text-sm text-muted-foreground">No sessions logged yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: training tracker with session log and history"
```

---

## Task 10: Match Tracker

**Files:**
- Create: `components/matches/MatchLogForm.tsx`
- Create: `app/(student)/matches/page.tsx`

- [ ] **Step 1: Create `components/matches/MatchLogForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const POSITIONS = ['GK','RB','CB','LB','CDM','CM','CAM','RW','LW','ST']

type Props = { studentId: string; onSaved: () => void }

export function MatchLogForm({ studentId, onSaved }: Props) {
  const supabase = createClient()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [opponent, setOpponent] = useState('')
  const [goals, setGoals] = useState('0')
  const [assists, setAssists] = useState('0')
  const [minutes, setMinutes] = useState('90')
  const [position, setPosition] = useState('ST')
  const [rating, setRating] = useState('7')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!opponent) return
    setSaving(true)
    await supabase.from('match_logs').insert({
      student_id: studentId,
      match_date: date,
      opponent,
      goals: Number(goals),
      assists: Number(assists),
      minutes_played: Number(minutes),
      position,
      self_rating: Number(rating),
      notes: notes || null,
    })
    setOpponent(''); setNotes('')
    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold text-sm">Log Match</h2>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input placeholder="Opponent" value={opponent} onChange={e => setOpponent(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="text-xs text-muted-foreground">Goals</label><Input type="number" value={goals} onChange={e => setGoals(e.target.value)} min="0" /></div>
        <div><label className="text-xs text-muted-foreground">Assists</label><Input type="number" value={assists} onChange={e => setAssists(e.target.value)} min="0" /></div>
        <div><label className="text-xs text-muted-foreground">Minutes</label><Input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} min="0" max="120" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={position} onChange={e => setPosition(e.target.value)} className="text-sm border rounded px-2 py-2">
          {POSITIONS.map(p => <option key={p}>{p}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Rating</label>
          <input type="range" min="1" max="10" value={rating} onChange={e => setRating(e.target.value)} className="flex-1" />
          <span className="text-sm font-bold w-4">{rating}</span>
        </div>
      </div>
      <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      <Button onClick={handleSave} disabled={saving || !opponent} className="w-full bg-tranmere-blue">
        {saving ? 'Saving...' : 'Log Match'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(student)/matches/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { MatchLogForm } from '@/components/matches/MatchLogForm'

export default async function MatchesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: matches } = await supabase
    .from('match_logs')
    .select('*')
    .eq('student_id', user!.id)
    .order('match_date', { ascending: false })

  const totalGoals = matches?.reduce((s, m) => s + m.goals, 0) ?? 0
  const totalAssists = matches?.reduce((s, m) => s + m.assists, 0) ?? 0
  const avgRating = matches?.length
    ? Math.round((matches.reduce((s, m) => s + (m.self_rating ?? 0), 0) / matches.length) * 10) / 10
    : 0

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Matches</h1>
      {matches && matches.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[['Goals', totalGoals], ['Assists', totalAssists], ['Avg Rating', avgRating]].map(([label, val]) => (
            <div key={label as string} className="bg-white rounded-xl border p-3 text-center">
              <p className="text-2xl font-bold text-tranmere-blue">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      <MatchLogForm studentId={user!.id} onSaved={() => {}} />
      <div className="space-y-2">
        {matches?.map(m => (
          <div key={m.id} className="bg-white rounded-xl border p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold">vs {m.opponent}</p>
                <p className="text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('en-GB')} · {m.position} · {m.minutes_played} mins</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{m.goals}G {m.assists}A</p>
                {m.self_rating && <p className="text-xs text-muted-foreground">{m.self_rating}/10</p>}
              </div>
            </div>
            {m.notes && <p className="text-xs text-muted-foreground mt-1 italic">{m.notes}</p>}
          </div>
        ))}
        {!matches?.length && <p className="text-sm text-muted-foreground">No matches logged yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: match tracker with stats log and season totals"
```

---

## Task 11: Admin Shell & Users

**Files:**
- Create: `components/layout/AdminSidebar.tsx`
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Create `components/layout/AdminSidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, BookOpen, Bell, BarChart2, GraduationCap } from 'lucide-react'
import Image from 'next/image'

const nav = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/courses', label: 'Courses', icon: GraduationCap },
  { href: '/admin/assignments', label: 'Assignments', icon: BookOpen },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-tranmere-blue text-white flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-blue-800">
        <Image src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png" alt="Tranmere" width={32} height={32} />
        <span className="font-bold text-sm">Admin Panel</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${pathname.startsWith(href) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'}`}>
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/layout.tsx`**

```tsx
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(admin)/admin/users/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { CreateUserForm } from './CreateUserForm'

export default async function UsersPage() {
  const supabase = createClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, role, created_at, courses(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>
      <CreateUserForm />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Name','Email','Role','Course','Joined'].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {users?.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className="capitalize">{u.role}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{(u.courses as any)?.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(admin)/admin/users/CreateUserForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const COURSES = [
  { id: '', name: 'None (Coach/Admin)' },
]

export function CreateUserForm() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'student' | 'coach' | 'admin'>('student')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleCreate() {
    setSaving(true)
    setMessage('')
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role }),
    })
    const data = await res.json()
    setMessage(data.error ?? 'Invite sent!')
    if (!data.error) { setEmail(''); setName('') }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3 max-w-lg">
      <h2 className="font-semibold">Invite New User</h2>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full text-sm border rounded px-2 py-2">
        <option value="student">Student</option>
        <option value="coach">Coach</option>
        <option value="admin">Admin</option>
      </select>
      <Button onClick={handleCreate} disabled={saving || !email || !name} className="bg-tranmere-blue">
        {saving ? 'Sending...' : 'Send Invite'}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Create `app/api/admin/create-user/route.ts`**

```ts
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Verify caller is admin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, name, role } = await request.json()

  // Use service role to invite user
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
  })

  if (error) return NextResponse.json({ error: error.message })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: admin panel with user management and invite flow"
```

---

## Task 12: Admin — Courses & Assignments

**Files:**
- Create: `app/(admin)/admin/courses/page.tsx`
- Create: `app/(admin)/admin/assignments/page.tsx`

- [ ] **Step 1: Create `app/(admin)/admin/courses/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { AddUnitForm } from './AddUnitForm'

export default async function CoursesPage() {
  const supabase = createClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, btec_units(id, unit_number, unit_name)')
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Courses & Units</h1>
      {courses?.map(course => (
        <div key={course.id} className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-tranmere-blue">{course.name}</h2>
          <table className="w-full text-sm">
            <thead className="border-b"><tr><th className="text-left py-1 text-muted-foreground">Unit</th><th className="text-left py-1 text-muted-foreground">Name</th></tr></thead>
            <tbody>
              {(course.btec_units as any[])?.map(u => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-sm">{u.unit_number}</td>
                  <td className="py-2">{u.unit_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <AddUnitForm courseId={course.id} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/admin/courses/AddUnitForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

export function AddUnitForm({ courseId }: { courseId: string }) {
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleAdd() {
    if (!number || !name) return
    setSaving(true)
    await supabase.from('btec_units').insert({ course_id: courseId, unit_number: number, unit_name: name })
    setNumber(''); setName('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <Input placeholder="Unit no." value={number} onChange={e => setNumber(e.target.value)} className="w-24" />
      <Input placeholder="Unit name" value={name} onChange={e => setName(e.target.value)} className="flex-1" />
      <Button onClick={handleAdd} disabled={saving || !number || !name} size="sm" className="bg-tranmere-blue">Add</Button>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(admin)/admin/assignments/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { CreateAssignmentForm } from './CreateAssignmentForm'

export default async function AssignmentsPage() {
  const supabase = createClient()
  const [{ data: assignments }, { data: units }] = await Promise.all([
    supabase.from('assignments').select('id, title, due_date, grade_target, btec_units(unit_name, courses(name))').order('due_date'),
    supabase.from('btec_units').select('id, unit_number, unit_name, course_id, courses(name)').order('unit_number'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assignments</h1>
      <CreateAssignmentForm units={units ?? []} />
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Title','Unit','Course','Due Date','Target'].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {assignments?.map(a => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{a.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{(a.btec_units as any)?.unit_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{(a.btec_units as any)?.courses?.name}</td>
                <td className="px-4 py-3">{new Date(a.due_date).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-3">{a.grade_target ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(admin)/admin/assignments/CreateAssignmentForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from 'next/navigation'

type Unit = { id: string; unit_number: string; unit_name: string; courses: any }

export function CreateAssignmentForm({ units }: { units: Unit[] }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  const [target, setTarget] = useState<'Pass' | 'Merit' | 'Distinction'>('Merit')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleCreate() {
    if (!title || !dueDate || !unitId) return
    setSaving(true)
    await supabase.from('assignments').insert({ title, description: description || null, unit_id: unitId, due_date: dueDate, grade_target: target })
    setTitle(''); setDescription(''); setDueDate('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3 max-w-xl">
      <h2 className="font-semibold">Create Assignment</h2>
      <Input placeholder="Assignment title" value={title} onChange={e => setTitle(e.target.value)} />
      <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      <div className="grid grid-cols-2 gap-2">
        <select value={unitId} onChange={e => setUnitId(e.target.value)} className="text-sm border rounded px-2 py-2">
          {units.map(u => <option key={u.id} value={u.id}>{u.courses?.name} — {u.unit_number}: {u.unit_name}</option>)}
        </select>
        <select value={target} onChange={e => setTarget(e.target.value as any)} className="text-sm border rounded px-2 py-2">
          <option>Pass</option><option>Merit</option><option>Distinction</option>
        </select>
      </div>
      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <Button onClick={handleCreate} disabled={saving || !title || !dueDate} className="bg-tranmere-blue">Create Assignment</Button>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: admin courses and assignment management"
```

---

## Task 13: Push Notification Infrastructure

**Files:**
- Create: `lib/webpush.ts`
- Create: `public/sw-push.js`
- Create: `app/api/push/subscribe/route.ts`
- Create: `app/api/push/send/route.ts`

- [ ] **Step 1: Generate VAPID keys**

```bash
node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + keys.publicKey); console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);"
```
Copy the output values into `.env.local` for `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

- [ ] **Step 2: Create `lib/webpush.ts`**

```ts
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
) {
  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload)
  )
}
```

- [ ] **Step 3: Create `public/sw-push.js`** (custom service worker additions)

```js
// This file is imported by next-pwa's custom worker configuration
// Handles push events and notification clicks

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url ?? '/'
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
```

- [ ] **Step 4: Update `next.config.js` to include custom SW**

```js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerDir: 'public',
  customWorkerSrc: 'sw-push.js',
})
```

- [ ] **Step 5: Create `app/api/push/subscribe/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, keys } = await request.json()
  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: 'user_id,endpoint' })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Create `app/api/push/send/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/webpush'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()
  if (!['admin','coach'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, body, targetUserIds } = await request.json()

  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = adminClient.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (targetUserIds?.length) query = query.in('user_id', targetUserIds)

  const { data: subs } = await query
  const results = await Promise.allSettled(
    (subs ?? []).map(sub => sendPushNotification(sub, { title, body, url: '/dashboard' }))
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent, total: subs?.length ?? 0 })
}
```

- [ ] **Step 7: Create push subscription hook — `app/(student)/dashboard/page.tsx` addition**

Add this client component for push opt-in. Create `components/PushOptIn.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export function PushOptIn() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'granted') registerPush()
  }, [])

  async function registerPush() {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    })
  }

  async function requestPermission() {
    const perm = await Notification.requestPermission()
    if (perm === 'granted') registerPush()
  }

  if (typeof window === 'undefined' || Notification.permission !== 'default') return null

  return (
    <button
      onClick={requestPermission}
      className="w-full text-sm bg-tranmere-gold text-tranmere-blue font-semibold py-2 rounded-lg"
    >
      Enable deadline notifications
    </button>
  )
}
```

Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your public key>` to `.env.local`.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: web push infrastructure, subscription API, and opt-in component"
```

---

## Task 14: Admin Notifications & Deadline Cron

**Files:**
- Create: `app/(admin)/admin/notifications/page.tsx`
- Create: `supabase/migrations/002_deadline_cron.sql`

- [ ] **Step 1: Create `app/(admin)/admin/notifications/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')

  async function handleSend() {
    if (!title || !body) return
    setSending(true)
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, targetUserIds: target === 'all' ? null : [] }),
    })
    const data = await res.json()
    setResult(`Sent to ${data.sent} / ${data.total} devices`)
    setSending(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Send Notification</h1>
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <Input placeholder="Notification title" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={3} />
        <select value={target} onChange={e => setTarget(e.target.value)} className="w-full text-sm border rounded px-2 py-2">
          <option value="all">All Students</option>
        </select>
        <Button onClick={handleSend} disabled={sending || !title || !body} className="w-full bg-tranmere-blue">
          {sending ? 'Sending...' : 'Send Push Notification'}
        </Button>
        {result && <p className="text-sm text-green-600">{result}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create deadline reminder cron — `supabase/migrations/002_deadline_cron.sql`**

```sql
-- Enable pg_cron (run once in Supabase SQL editor — requires pg_cron extension)
create extension if not exists pg_cron;

-- Schedule deadline reminder check daily at 8am UTC
select cron.schedule(
  'deadline-reminders',
  '0 8 * * *',
  $$
  -- Find assignments due in exactly 7 days
  select
    s.student_id,
    a.title,
    a.due_date
  from assignments a
  join submissions s on s.assignment_id = a.id
  where
    a.due_date = current_date + interval '7 days'
    and s.status not in ('submitted', 'graded');

  -- Note: the actual push send is handled by a Supabase Edge Function
  -- triggered by this cron. See supabase/functions/deadline-reminder/index.ts
  $$
);
```

- [ ] **Step 3: Create Supabase Edge Function for deadline reminders**

Create `supabase/functions/deadline-reminder/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const in1 = new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0]

  for (const daysAway of [{ date: in7, label: '7 days' }, { date: in1, label: 'tomorrow' }]) {
    const { data: due } = await supabase
      .from('assignments')
      .select('id, title, submissions(student_id), btec_units(course_id)')
      .eq('due_date', daysAway.date)

    for (const assignment of due ?? []) {
      for (const sub of (assignment.submissions as any[]) ?? []) {
        if (['submitted','graded'].includes(sub.status)) continue

        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', sub.student_id)

        for (const pushSub of subs ?? []) {
          // Import webpush equivalent for Deno
          // Use fetch to call our own send endpoint instead
          await fetch(`${Deno.env.get('APP_URL')}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-edge-secret': Deno.env.get('EDGE_SECRET')! },
            body: JSON.stringify({
              title: `Assignment due ${daysAway.label}!`,
              body: assignment.title,
              targetUserIds: [sub.student_id],
            }),
          })
        }
      }
    }
  }

  return new Response('ok')
})
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: admin notifications panel and deadline reminder cron"
```

---

## Task 15: Admin Reports

**Files:**
- Create: `app/(admin)/admin/reports/page.tsx`

- [ ] **Step 1: Create `app/(admin)/admin/reports/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'

export default async function ReportsPage() {
  const supabase = createClient()

  const { data: students } = await supabase
    .from('users')
    .select(`
      id, name, email,
      courses(name),
      submissions(status),
      nutrition_logs(calories, logged_date),
      training_logs(id),
      match_logs(goals, assists)
    `)
    .eq('role', 'student')
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Student Reports</h1>
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Student','Course','Assignments','Submitted','Training Sessions','Total Goals','Total Assists'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students?.map(s => {
              const subs = (s.submissions as any[]) ?? []
              const submitted = subs.filter(x => ['submitted','graded'].includes(x.status)).length
              const trainingSessions = (s.training_logs as any[])?.length ?? 0
              const goals = (s.match_logs as any[])?.reduce((acc: number, m: any) => acc + (m.goals ?? 0), 0) ?? 0
              const assists = (s.match_logs as any[])?.reduce((acc: number, m: any) => acc + (m.assists ?? 0), 0) ?? 0

              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{(s.courses as any)?.name ?? '—'}</td>
                  <td className="px-4 py-3">{subs.length}</td>
                  <td className="px-4 py-3">
                    <span className={submitted === subs.length && subs.length > 0 ? 'text-green-600 font-semibold' : ''}>
                      {submitted}/{subs.length}
                    </span>
                  </td>
                  <td className="px-4 py-3">{trainingSessions}</td>
                  <td className="px-4 py-3">{goals}</td>
                  <td className="px-4 py-3">{assists}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: admin reports with per-student progress overview"
```

---

## Task 16: Profile Page & Final Polish

**Files:**
- Create: `app/(student)/profile/page.tsx`

- [ ] **Step 1: Create `app/(student)/profile/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/(auth)/login/actions'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role, courses(name)')
    .eq('id', user!.id)
    .single()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Profile</h1>
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Name</p>
          <p className="font-semibold">{profile?.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm">{profile?.email}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Course</p>
          <p className="text-sm">{(profile?.courses as any)?.name ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Role</p>
          <p className="text-sm capitalize">{profile?.role}</p>
        </div>
      </div>
      <form action={signOut}>
        <button type="submit" className="w-full py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
          Sign Out
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Add Profile link to BottomNav**

In `components/layout/BottomNav.tsx`, add to the `nav` array:

```ts
{ href: '/profile', label: 'Profile', icon: User },
```

And import `User` from lucide-react.

- [ ] **Step 3: Run all tests**

```bash
npx jest --passWithNoTests
```
Expected: All tests PASS

- [ ] **Step 4: Run build to catch TypeScript errors**

```bash
npm run build
```
Expected: Build succeeds with no errors. Fix any type errors before proceeding.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: profile page, sign out, and complete student nav"
```

---

## Deployment

- [ ] Push to GitHub: `git remote add origin <repo-url> && git push -u origin main`
- [ ] Connect repo to [vercel.com](https://vercel.com) → New Project → import repo
- [ ] Add all `.env.local` variables as Vercel environment variables
- [ ] Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to Vercel env vars
- [ ] Deploy — Vercel builds and assigns a `.vercel.app` URL
- [ ] In Supabase dashboard → Authentication → URL Configuration → add Vercel URL to "Site URL" and "Redirect URLs"
- [ ] Test sign-in flow end-to-end on deployed URL
- [ ] Install PWA on phone: open in mobile browser → "Add to Home Screen"
