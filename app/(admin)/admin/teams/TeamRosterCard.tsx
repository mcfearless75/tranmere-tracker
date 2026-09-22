'use client'

import { useState, useTransition } from 'react'
import { UserPlus, X, AlertCircle } from 'lucide-react'
import { setUserTeam, setUsersTeam } from './teamActions'
import { TeamBadge } from '@/components/TeamBadge'
import { YearBadge } from '@/components/YearBadge'
import type { Team, ActionResult } from '@/lib/teams/types'

type Member = { id: string; name: string; role: string; year_group: number | null; team_id: string | null }

/**
 * One team's roster, or the Unassigned bucket when `team` is null.
 *
 * The Unassigned card leads the page and disappears once it is empty — it is
 * the only thing that stops a player who is in no team being quietly
 * forgotten, which is the main adoption risk of making team_id nullable.
 */
export function TeamRosterCard({
  team, roster, teams, candidates,
}: {
  team: Team | null
  roster: Member[]
  teams: Team[]
  candidates: Member[]
}) {
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const byId = new Map(teams.map(t => [t.id, t]))

  /**
   * Actions report a reason via {ok, error}; the catch is only for the
   * request itself failing (offline, a 5xx, a deploy landing mid-call), which
   * rejects rather than returning.
   */
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

  function toggle(id: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addPicked() {
    if (!team || picked.size === 0) return
    const ids = Array.from(picked)
    run(async () => {
      const result = await setUsersTeam(ids, team.id)
      setPicked(new Set())
      setAdding(false)
      return result
    })
  }

  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-tranmere-blue flex items-center gap-2">
          {team ? team.name : 'Unassigned'}
          <span className="text-xs font-normal text-muted-foreground">{roster.length}</span>
        </h2>
        {team && (
          <button
            onClick={() => setAdding(v => !v)}
            disabled={pending}
            className="inline-flex items-center gap-1 text-xs font-semibold text-tranmere-blue disabled:opacity-60"
          >
            <UserPlus size={13} /> {adding ? 'Cancel' : 'Add players'}
          </button>
        )}
      </div>

      {!team && (
        <p className="text-xs text-muted-foreground mb-2 flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          These players are in no team, so they are not pre-picked for any match squad.
        </p>
      )}

      {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}

      {roster.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">No players yet</p>
      ) : (
        <ul className="space-y-1">
          {roster.map(m => (
            <li key={m.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50">
              <span className="flex-1 min-w-0 text-sm truncate">{m.name}</span>
              {m.role === 'student'
                ? <YearBadge year={m.year_group} />
                : <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>}
              {team ? (
                <button
                  onClick={() => run(() => setUserTeam(m.id, null))}
                  disabled={pending}
                  aria-label={`Remove ${m.name} from ${team.name}`}
                  className="p-1 rounded text-gray-400 hover:text-red-600 disabled:opacity-60"
                >
                  <X size={14} />
                </button>
              ) : (
                <select
                  aria-label={`Team for ${m.name}`}
                  defaultValue=""
                  disabled={pending}
                  onChange={e => e.target.value && run(() => setUserTeam(m.id, e.target.value))}
                  className="text-xs border rounded px-1 py-0.5 bg-white disabled:opacity-60"
                >
                  <option value="">Place in…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && team && (
        <div className="mt-3 border-t pt-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
            Add to {team.name} — their current team is shown, so this moves them
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
            {candidates.map(c => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-1.5 p-2 rounded-lg border text-left text-sm ${
                  picked.has(c.id) ? 'border-tranmere-blue bg-blue-50 font-semibold' : 'border-gray-200'
                }`}
              >
                <span className="flex-1 min-w-0 truncate">{c.name}</span>
                <TeamBadge team={c.team_id ? byId.get(c.team_id) ?? null : null} />
              </button>
            ))}
          </div>
          <button
            onClick={addPicked}
            disabled={pending || picked.size === 0}
            className="mt-2 w-full rounded-xl bg-tranmere-blue text-white py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {pending ? 'Saving…' : `Move ${picked.size} to ${team.name}`}
          </button>
        </div>
      )}
    </div>
  )
}
