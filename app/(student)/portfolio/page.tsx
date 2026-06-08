import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  groupByType,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_COLOURS,
  VALID_ENTRY_TYPES,
} from '@/lib/portfolio/portfolioUtils'
import type { PortfolioEntry } from '@/lib/portfolio/portfolioUtils'
import PortfolioEntryForm from '@/components/portfolio/PortfolioEntryForm'

export const dynamic = 'force-dynamic'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function PortfolioPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawEntries } = await supabase
    .from('portfolio_entries')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const entries: PortfolioEntry[] = rawEntries ?? []
  const grouped = groupByType(entries)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">My Portfolio</h1>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {VALID_ENTRY_TYPES.map(type => (
          <span
            key={type}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ENTRY_TYPE_COLOURS[type]}`}
          >
            {ENTRY_TYPE_LABELS[type]}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold">
              {grouped[type].length}
            </span>
          </span>
        ))}
      </div>

      {/* Add entry form */}
      <PortfolioEntryForm />

      {/* Entries grouped by type */}
      {entries.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          No portfolio entries yet. Add your first one above.
        </p>
      )}

      {VALID_ENTRY_TYPES.map(type => {
        const typeEntries = grouped[type]
        if (typeEntries.length === 0) return null
        return (
          <section key={type} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {ENTRY_TYPE_LABELS[type]}
            </h2>
            <div className="space-y-3">
              {typeEntries.map(entry => (
                <article
                  key={entry.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{entry.title}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ENTRY_TYPE_COLOURS[entry.entry_type]}`}
                    >
                      {ENTRY_TYPE_LABELS[entry.entry_type]}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-sm text-gray-600">{entry.description}</p>
                  )}
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
