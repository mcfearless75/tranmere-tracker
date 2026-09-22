'use client'

import { useState, useTransition } from 'react'
import { Plus, Archive, ChevronUp, ChevronDown } from 'lucide-react'
import { createTeam, renameTeam, setTeamActive, reorderTeams } from './teamActions'
import { TEAM_NAME_MAX, type Team, type ActionResult } from '@/lib/teams/types'

/** Returns the team ids with the one at `from` moved to `to`. */
function move(teams: Team[], from: number, to: number): string[] {
  const ids = teams.map(t => t.id)
  const [moved] = ids.splice(from, 1)
  ids.splice(to, 0, moved)
  return ids
}

export function ManageTeams({ teams }: { teams: Team[] }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  /** Same contract as TeamRosterCard's: {ok, error} for a refusal, catch for transport. */
  function run(fn: () => Promise<ActionResult>) {
    setError(null)
    start(async () => {
      try {
        const result = await fn()
        if (!result.ok) setError(result.error)
      } catch {
        setError('Not saved — try again')
      }
    })
  }

  return (
    <div className="rounded-2xl border bg-white p-3">
      <h2 className="text-sm font-semibold text-tranmere-blue mb-2">Manage teams</h2>
      {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}

      <ul className="space-y-1 mb-3">
        {teams.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2">
            <input
              aria-label={`Rename ${t.name}`}
              defaultValue={t.name}
              maxLength={TEAM_NAME_MAX}
              disabled={pending}
              onBlur={e => {
                const next = e.target.value.trim()
                if (next && next !== t.name) run(() => renameTeam(t.id, next))
              }}
              className="flex-1 min-w-0 text-sm border rounded px-2 py-1.5 disabled:opacity-60"
            />
            {/* Up/down rather than drag: this page is used on a phone, where
                dragging a list item fights the page scroll. */}
            <button
              onClick={() => run(() => reorderTeams(move(teams, i, i - 1)))}
              disabled={pending || i === 0}
              aria-label={`Move ${t.name} up`}
              className="p-1.5 rounded text-gray-400 hover:text-tranmere-blue disabled:opacity-30"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => run(() => reorderTeams(move(teams, i, i + 1)))}
              disabled={pending || i === teams.length - 1}
              aria-label={`Move ${t.name} down`}
              className="p-1.5 rounded text-gray-400 hover:text-tranmere-blue disabled:opacity-30"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Retire ${t.name}? Its players become unassigned until it is restored.`)) {
                  run(() => setTeamActive(t.id, false))
                }
              }}
              disabled={pending}
              aria-label={`Retire ${t.name}`}
              className="p-2 rounded text-gray-400 hover:text-red-600 disabled:opacity-60"
            >
              <Archive size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t pt-3">
        <input
          aria-label="New team name"
          value={newName}
          maxLength={TEAM_NAME_MAX}
          disabled={pending}
          onChange={e => setNewName(e.target.value)}
          placeholder="New team name"
          className="flex-1 min-w-0 text-sm border rounded px-2 py-1.5 disabled:opacity-60"
        />
        <button
          onClick={() => run(async () => {
            const result = await createTeam(newName)
            setNewName('')
            return result
          })}
          disabled={pending || !newName.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
