import Link from 'next/link'
import { CatapultMetricsPreview } from '@/components/catapult/CatapultMetricsPreview'

export const metadata = {
  title: 'Catapult Performance Data',
}

// TODO: replace with the real Catapult athlete portal URL once the
// vendor account and API credentials are provisioned.
const CATAPULT_PORTAL_URL = 'https://www.catapult.com'

export default function CatapultPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 pb-24">
      <div className="mx-auto max-w-lg space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Catapult Performance Data
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Catapult is the club&apos;s GPS and athlete-tracking platform. The wearable
            pods worn in training and matches capture distance, speed, load and
            heart-rate data to help you and the coaching staff understand your
            physical performance.
          </p>
        </div>

        {/* Pending-credentials notice */}
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <span className="mt-0.5 text-amber-600" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5Zm-.75 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Live sync coming soon
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-700">
              We&apos;re still setting up the secure connection to Catapult. Once the
              integration is approved, your session metrics will sync here
              automatically — no manual entry needed.
            </p>
          </div>
        </div>

        {/* Metrics preview */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Metrics that will sync
          </h2>
          <CatapultMetricsPreview />
        </section>

        {/* How it fits alongside existing GPS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-slate-800">
            Alongside your existing GPS data
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-500">
            Catapult will complement the GPS sessions already shown on your
            performance pages. Until the sync is live, keep checking those for
            the latest training and match numbers.
          </p>
          <Link
            href="/performance"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 transition hover:text-teal-900"
          >
            View My Performance
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* External link CTA */}
        <div className="rounded-2xl bg-teal-700 p-6 shadow-md">
          <p className="mb-1 text-sm font-medium text-teal-100">
            About Catapult
          </p>
          <p className="mb-4 text-sm leading-relaxed text-white">
            Learn more about the platform the club uses to track athlete
            performance.
          </p>
          <Link
            href={CATAPULT_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50 active:scale-95"
          >
            Visit Catapult
            <span aria-hidden="true">→</span>
          </Link>
        </div>

      </div>
    </main>
  )
}
