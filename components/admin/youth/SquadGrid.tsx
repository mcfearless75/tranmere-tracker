import Link from 'next/link'
import { CalendarDays, Users } from 'lucide-react'
import { SquadSummary } from './types'

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function SquadGrid({ squads }: { squads: SquadSummary[] }) {
  if (squads.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-muted-foreground">
        No youth squads yet. Create the first one below.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {squads.map(squad => (
        <Link
          key={squad.id}
          href={`/admin/youth/${squad.id}`}
          className="block rounded-2xl border border-gray-200 bg-white p-4 active:opacity-90"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">{squad.name}</h2>
            <span className="shrink-0 rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {squad.age_group}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Coach: {squad.coachName ?? 'Unassigned'}
          </p>
          <div className="mt-3 space-y-1 text-xs text-gray-700">
            <p className="flex items-center gap-1.5">
              <Users size={14} className="text-tranmere-blue" />
              {squad.playerCount} {squad.playerCount === 1 ? 'player' : 'players'}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-tranmere-blue" />
              {squad.nextFixture
                ? `Next: ${squad.nextFixture.opponent}, ${formatDate(squad.nextFixture.fixture_date)}`
                : 'No upcoming fixtures'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
