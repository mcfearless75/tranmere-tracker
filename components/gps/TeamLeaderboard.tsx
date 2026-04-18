'use client'

import { Trophy, Zap, Gauge, Route, Activity } from 'lucide-react'

type Row = { name: string; value: number; display: string }

const RANK_STYLE = [
  'bg-gradient-to-r from-yellow-400 to-amber-500 text-white',   // 1st
  'bg-gradient-to-r from-gray-300 to-gray-400 text-white',      // 2nd
  'bg-gradient-to-r from-orange-400 to-orange-600 text-white',  // 3rd
]

function RankChip({ rank }: { rank: number }) {
  if (rank < 3) {
    return (
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow ${RANK_STYLE[rank]}`}>
        {rank + 1}
      </span>
    )
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
      {rank + 1}
    </span>
  )
}

function Board({ title, icon, rows, unit }: { title: string; icon: React.ReactNode; rows: Row[]; unit?: string }) {
  const max = Math.max(...rows.map(r => r.value), 1)

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-blue-50 p-1.5 text-tranmere-blue">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
        )}
        {rows.slice(0, 5).map((r, i) => (
          <div key={r.name} className="relative overflow-hidden rounded-lg bg-gray-50 p-2">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-100 to-blue-50 transition-all duration-700 ease-out"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <RankChip rank={i} />
                <span className="truncate text-sm font-medium">{r.name}</span>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-tranmere-blue">
                {r.display}{unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TeamLeaderboard({
  distance, topSpeed, sprints, load,
}: {
  distance: Row[]; topSpeed: Row[]; sprints: Row[]; load: Row[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Board title="Top Distance" icon={<Route size={16} />} rows={distance} unit="km" />
      <Board title="Fastest"      icon={<Gauge size={16} />} rows={topSpeed} unit="km/h" />
      <Board title="Most Sprints" icon={<Zap size={16} />}   rows={sprints} />
      <Board title="Highest Load" icon={<Activity size={16} />} rows={load} />
    </div>
  )
}
