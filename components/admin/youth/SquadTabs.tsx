'use client'

import { useState } from 'react'
import { PlayerCard } from './PlayerCard'
import { AddPlayerForm } from './AddPlayerForm'
import { FixtureList } from './FixtureList'
import { AddFixtureForm } from './AddFixtureForm'
import { YouthFixtureRow, YouthPlayerRow } from './types'

type Tab = 'roster' | 'fixtures'

interface SquadTabsProps {
  squadId: string
  players: YouthPlayerRow[]
  fixtures: YouthFixtureRow[]
}

export function SquadTabs({ squadId, players, fixtures }: SquadTabsProps) {
  const [tab, setTab] = useState<Tab>('roster')

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Squad sections">
        {([
          ['roster', `Roster (${players.length})`],
          ['fixtures', `Fixtures (${fixtures.length})`],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === value
                ? 'bg-tranmere-blue text-white'
                : 'border border-gray-200 bg-white text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <div className="space-y-4">
          {players.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-muted-foreground">
              No players in this squad yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {players.map(player => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          )}
          <AddPlayerForm squadId={squadId} />
        </div>
      )}

      {tab === 'fixtures' && (
        <div className="space-y-4">
          <FixtureList fixtures={fixtures} />
          <AddFixtureForm squadId={squadId} />
        </div>
      )}
    </div>
  )
}
