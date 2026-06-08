import Link from 'next/link'

export const metadata = {
  title: 'Report a Concern',
}

export default function MyConcernPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 pb-24">
      <div className="mx-auto max-w-lg space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-navy-900 text-slate-900">
            Report a Concern
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            MyConcern is the school&apos;s online safeguarding and wellbeing reporting tool.
            Use it to report anything that worries you — about yourself or someone else.
            All reports are confidential and handled by trained staff.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="rounded-2xl bg-teal-700 p-6 shadow-md">
          <p className="mb-1 text-sm font-medium text-teal-100">
            Submit a report securely
          </p>
          <p className="mb-4 text-white text-sm leading-relaxed">
            Your report goes directly to the safeguarding team. You can report
            anonymously or leave your name — it&apos;s your choice.
          </p>
          <Link
            href="https://www.myconcern.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50 active:scale-95"
          >
            Open MyConcern
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Speak to someone */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            Speak to someone
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            If you prefer to talk to someone in person, any of the following can help:
          </p>
          <ul className="space-y-3">
            {[
              { role: 'Tutor', detail: 'Your first point of contact for day-to-day concerns.' },
              { role: 'Head of Year', detail: 'Available for more serious or ongoing issues.' },
              { role: 'School Safeguarding Lead', detail: 'Trained to handle all safeguarding matters in confidence.' },
            ].map(({ role, detail }) => (
              <li key={role} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{role}</p>
                  <p className="text-xs text-slate-500">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Emergency notice */}
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
          <span className="mt-0.5 text-red-600" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </span>
          <p className="text-sm font-medium text-red-800">
            In an emergency, always call <span className="font-bold">999</span>.
          </p>
        </div>

      </div>
    </main>
  )
}
