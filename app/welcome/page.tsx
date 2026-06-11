import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tranmere Tracker — The Performance Platform Built for the Club',
  description:
    'One platform for player performance, match analysis, GPS data, AI coaching insight and parent communication. Built around Tranmere Rovers.',
}

const FEATURES = [
  {
    title: 'Match & Player Tracking',
    body: 'Every fixture, every minute, every rating — logged once and visible to coaches, players and parents instantly.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    title: 'QR Check-In',
    body: 'Players scan in at training and matchday. Attendance, punctuality and availability handled without a clipboard in sight.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M21 21v.01M17.5 17.5h.01" />
      </svg>
    ),
  },
  {
    title: 'GPS & Load Data',
    body: 'Distance, sprints and workload per session — trends charted over the season so nothing creeps up unseen.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M14 8h6v6" />
      </svg>
    ),
  },
  {
    title: 'AI Coaching Insight',
    body: 'Claude-powered analysis turns raw numbers into plain-English coaching notes after every match.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.5 4-2.5 5.5-.5.8-.5 1.5-.5 2.5h-6c0-1-.05-1.7-.55-2.5C7.45 13 6 11.5 6 9a6 6 0 0 1 6-6z" />
        <path d="M9.5 20h5M10.5 22.5h3" />
      </svg>
    ),
  },
  {
    title: 'Team Chat & Push Alerts',
    body: 'Squad rooms, broadcast channels and push notifications — selection news lands on every phone at once.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.2-.6L3 21l1.7-5.8A8.38 8.38 0 0 1 3.6 11.5a8.5 8.5 0 0 1 8.7-8.5 8.38 8.38 0 0 1 8.7 8.5z" />
      </svg>
    ),
  },
  {
    title: 'Parents in the Loop',
    body: 'Dedicated parent views for progress, fixtures and coursework — fewer phone calls, better trust.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

const STATS = [
  { value: 'One', label: 'platform for the whole club' },
  { value: '4', label: 'tailored views — player, parent, coach, admin' },
  { value: '90s', label: 'from final whistle to AI match report' },
  { value: '0', label: 'spreadsheets left behind' },
]

const AUDIENCES = [
  {
    role: 'For Coaches',
    line: 'Selection, sessions and player development backed by data you already collect — not extra admin.',
  },
  {
    role: 'For Players',
    line: 'See your ratings, GPS numbers and progress in one place. Know exactly what to work on next.',
  },
  {
    role: 'For Parents',
    line: 'Fixtures, progress and club news on your phone — without chasing anyone for an update.',
  },
]

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#021333] text-white">
      {/* Crest watermark */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="relative h-[140vmin] w-[140vmin] opacity-[0.05]">
          <Image
            src="/icons/icon-512.png"
            alt=""
            fill
            sizes="140vmin"
            className="object-contain grayscale"
            priority
          />
        </div>
      </div>

      {/* Soft brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,48,135,0.55), transparent 60%), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(212,175,55,0.08), transparent 60%)',
        }}
      />

      <div className="relative">
        {/* Nav */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <Image src="/icons/icon-192.png" alt="Tranmere Rovers crest" width={40} height={40} />
            <span className="text-lg font-semibold tracking-tight">
              Tranmere <span className="text-[#D4AF37]">Tracker</span>
            </span>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white/90 transition-colors duration-200 hover:border-[#D4AF37] hover:text-[#D4AF37] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            Sign in
          </Link>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="mb-5 inline-block rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
            Ubi fides ibi lux et robur
          </p>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Every player. Every match.
            <span className="block text-[#D4AF37]">One platform.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-blue-100/85">
            Tranmere Tracker brings match tracking, GPS data, AI coaching insight, QR check-in and
            parent communication into a single app — built around how a football club actually runs.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/"
              className="w-full rounded-full bg-[#D4AF37] px-8 py-4 text-base font-semibold text-[#021333] shadow-lg shadow-[#D4AF37]/20 transition-colors duration-200 hover:bg-[#e8c757] focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
            >
              Open the App
            </Link>
            <a
              href="#features"
              className="w-full rounded-full border border-white/25 px-8 py-4 text-base font-semibold text-white transition-colors duration-200 hover:border-white/60 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] sm:w-auto"
            >
              See What It Does
            </a>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-y border-white/10 bg-white/[0.03] backdrop-blur-sm">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 py-10 text-center sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-4 py-2">
                <dt className="order-2 mt-1 text-sm leading-snug text-blue-100/70">{stat.label}</dt>
                <dd className="text-3xl font-bold text-[#D4AF37]">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-10 px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Run the club from one place
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-blue-100/75">
            No more juggling spreadsheets, group chats and paper registers. Everything a modern
            football operation needs, under one badge.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-colors duration-200 hover:border-[#D4AF37]/50 hover:bg-white/[0.07]"
              >
                <div className="mb-4 inline-flex rounded-xl bg-[#003087] p-3 text-[#D4AF37] ring-1 ring-white/10">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-blue-100/70">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Audiences */}
        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div key={audience.role}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
                  {audience.role}
                </h3>
                <p className="mt-3 leading-relaxed text-blue-100/85">{audience.line}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to see it on the pitch?
          </h2>
          <p className="mt-4 text-lg text-blue-100/80">
            The platform is live, in use, and built to grow with the club.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-[#D4AF37] px-10 py-4 text-base font-semibold text-[#021333] shadow-lg shadow-[#D4AF37]/20 transition-colors duration-200 hover:bg-[#e8c757] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Open Tranmere Tracker
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-blue-100/60 sm:flex-row">
            <p>Tranmere Tracker — football performance platform · based at The Solar Campus</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="transition-colors duration-200 hover:text-[#D4AF37]">
                Privacy
              </Link>
              <Link href="/" className="transition-colors duration-200 hover:text-[#D4AF37]">
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
