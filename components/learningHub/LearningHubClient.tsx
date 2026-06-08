'use client'

import { useState } from 'react'
import {
  CATEGORY_LABELS,
  CATEGORY_COLOURS,
  filterByCategory,
  searchResources,
  type LearningResource,
  type ResourceCategory,
} from '@/lib/learningHub/learningHubUtils'
import { Search, ExternalLink } from 'lucide-react'

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ResourceCategory[]

interface LearningHubClientProps {
  resources: LearningResource[]
}

function ResourceCard({ resource }: { resource: LearningResource }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
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
  )
}

export function LearningHubClient({ resources }: LearningHubClientProps) {
  const [activeCategory, setActiveCategory] = useState<ResourceCategory | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = (() => {
    let result = activeCategory
      ? filterByCategory(resources, activeCategory)
      : resources
    result = searchResources(result, searchQuery)
    return result
  })()

  return (
    <div>
      {/* Search */}
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search resources…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Category chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            activeCategory === null
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              activeCategory === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Results count */}
      {(searchQuery.trim() || activeCategory) && (
        <p className="mb-4 text-xs text-gray-400">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No resources match your search.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  )
}
