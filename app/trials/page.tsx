import Image from 'next/image'
import type { Metadata } from 'next'
import { TrialApplicationForm } from '@/components/recruitment/TrialApplicationForm'

export const metadata: Metadata = {
  title: 'Trial with the Academy | Tranmere Tracker',
  description:
    'Apply for a trial with the Tranmere Rovers Academy. Open to players aged 10 to 21 with parent/guardian consent.',
}

const WHAT_TO_EXPECT = [
  'A structured session with our academy coaches — small-sided games, technical drills and match play',
  'An honest assessment of where you are now and what your next step looks like',
  'Feedback for you and your parent/guardian after the session',
  'No cost to attend — just bring boots, shin pads and a water bottle',
]

export default function TrialsPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-tranmere-blue p-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
            alt="Tranmere Rovers FC"
            width={80}
            height={80}
            priority
          />
          <h1 className="text-2xl font-bold text-tranmere-blue">Trial with the Academy</h1>
          <p className="text-sm text-muted-foreground">
            Think you&apos;ve got what it takes? Tell us about yourself and our recruitment team will
            be in touch about upcoming trial dates.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-tranmere-blue">What to expect</h2>
          <ul className="mt-2 space-y-2">
            {WHAT_TO_EXPECT.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-gray-700">
                <span aria-hidden="true" className="mt-0.5 text-tranmere-blue">
                  &bull;
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <TrialApplicationForm />

        <p className="text-center text-xs text-muted-foreground">
          Applications from players under 18 must include parent/guardian consent. Your details are
          only used by our recruitment staff to arrange trials.
        </p>
      </div>
    </div>
  )
}
