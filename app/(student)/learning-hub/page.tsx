import { BookOpen, ExternalLink } from 'lucide-react'
import {
  RESOURCES,
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  getFeatured,
} from '@/lib/learningHub/learningHubUtils'
import { LearningHubClient } from '@/components/learningHub/LearningHubClient'

export const metadata = {
  title: 'Learning Hub | Tranmere Tracker',
  description: 'Curated study and wellbeing resources for Tranmere Rovers Academy learners.',
}

export default function LearningHubPage() {
  const featured = getFeatured(RESOURCES)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Learning Hub</h1>
          </div>
          <p className="text-sm text-gray-500">
            Handpicked resources to support your studies, sport and wellbeing.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        {/* Featured section */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Featured
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((resource) => (
              <div
                key={resource.id}
                className="flex flex-col rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                    {resource.title}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOURS[resource.category]}`}
                  >
                    {CATEGORY_LABELS[resource.category]}
                  </span>
                </div>
                <p className="mb-4 flex-1 text-xs text-gray-500 leading-relaxed">
                  {resource.description}
                </p>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* All resources — client component handles filter + search */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            All Resources
          </h2>
          <LearningHubClient resources={RESOURCES} />
        </section>
      </div>
    </div>
  )
}
