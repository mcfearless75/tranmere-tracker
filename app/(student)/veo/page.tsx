import Link from 'next/link'
import { VeoComingSoon } from '@/components/VeoComingSoon'

export const metadata = {
  title: 'Match Analysis (VEO)',
}

// TODO: Replace with the club's actual VEO platform URL once API credentials are provisioned.
const VEO_PLATFORM_URL = 'https://app.veo.co'

export default function VeoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 pb-24">
      <div className="mx-auto max-w-lg space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-navy-900 text-slate-900">
            Match Analysis (VEO)
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            VEO is the club&apos;s match-recording and video-analysis platform.
            It captures full fixtures automatically, so coaches can tag key
            moments and you can review your own performance clip by clip.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="rounded-2xl bg-blue-700 p-6 shadow-md">
          <p className="mb-1 text-sm font-medium text-blue-100">
            Watch your matches
          </p>
          <p className="mb-4 text-white text-sm leading-relaxed">
            Open the VEO platform to stream recorded fixtures and review the
            highlights your coaches have tagged.
          </p>
          <Link
            href={VEO_PLATFORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50 active:scale-95"
          >
            Open VEO
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Embedded clips (pending API connection) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">
            Your clips
          </h2>
          <VeoComingSoon />
        </div>

        {/* Connection notice */}
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <span className="mt-0.5 text-amber-600" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
          </span>
          <p className="text-sm font-medium text-amber-800">
            The VEO integration is not connected yet. Embedded clips will switch
            on automatically once the club&apos;s API credentials are in place.
          </p>
        </div>

      </div>
    </main>
  )
}
