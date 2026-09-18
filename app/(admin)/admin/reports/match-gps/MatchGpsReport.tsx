'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { downloadHoaPack } from '@/lib/gps/buildHoaPack'

type Row = {
  id: string
  session_date: string
  session_label: string | null
  total_distance_m: number | null
  hsr_distance_m: number | null
  sprint_distance_m: number | null
  max_speed_kmh: number | null
  sprint_count: number | null
  player_load: number | null
  duration_mins: number | null
  accel_count: number | null
  decel_count: number | null
  users?: { name?: string | null } | { name?: string | null }[] | null
}

function nameOf(row: Row) {
  const u = row.users
  if (Array.isArray(u)) return u[0]?.name ?? 'Unknown'
  return u?.name ?? 'Unknown'
}

function n(v: number | null | undefined, d = 0) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(d)
}

export function MatchGpsReport({
  initialDate,
  initialQ,
  rows,
}: {
  initialDate: string
  initialQ: string
  rows: Row[]
}) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [q, setQ] = useState(initialQ)
  const [busy, setBusy] = useState(false)

  const distances = rows.map((r) => Number(r.total_distance_m) || 0)
  const speeds = rows.map((r) => Number(r.max_speed_kmh) || 0).filter((v) => v > 0)
  const totalDist = distances.reduce((a, b) => a + b, 0)
  const avgDist = rows.length ? totalDist / rows.length : 0
  const maxSp = speeds.length ? Math.max(...speeds) : 0

  async function handlePack() {
    if (!rows.length) return
    setBusy(true)
    try {
      await downloadHoaPack({
        date,
        opposition: q || 'Opposition',
        players: rows.map((r) => ({
          name: nameOf(r),
          distanceM: Number(r.total_distance_m) || 0,
          sprintM: Number(r.sprint_distance_m ?? r.hsr_distance_m) || 0,
          maxKmh: Number(r.max_speed_kmh) || 0,
          load: Number(r.player_load) || 0,
        })),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form
        className="flex flex-wrap gap-2 items-end print:hidden"
        onSubmit={(e) => {
          e.preventDefault()
          router.push(`/admin/reports/match-gps?date=${date}&q=${encodeURIComponent(q)}`)
        }}
      >
        <label className="text-xs font-semibold uppercase text-muted-foreground">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-semibold uppercase text-muted-foreground">
          Opposition / label
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Oldham" className="mt-1 block rounded-lg border px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-xl bg-tranmere-blue text-white px-4 py-2 text-sm font-semibold">
          Load report
        </button>
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-tranmere-yellow text-gray-900 px-4 py-2 text-sm font-semibold">
          Print / PDF
        </button>
        <button
          type="button"
          disabled={!rows.length || busy}
          onClick={handlePack}
          className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? 'Building pack…' : 'Download HoA pack'}
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Players" value={String(rows.length)} />
        <Stat label="Squad distance" value={rows.length ? `${(totalDist / 1000).toFixed(1)} km` : '—'} />
        <Stat label="Avg distance" value={rows.length ? `${Math.round(avgDist)} m` : '—'} />
        <Stat label="Top speed" value={maxSp ? `${maxSp.toFixed(1)} km/h` : '—'} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-5 text-sm text-muted-foreground">
          No Catapult rows for this date/label yet. Import the CSV at{' '}
          <a className="text-tranmere-blue underline" href="/admin/gps-import">Admin → Import GPS</a>
          , set the session label to the opposition (e.g. Oldham), then tap Load report.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Player</th>
                <th className="p-3">Label</th>
                <th className="p-3">Dist m</th>
                <th className="p-3">HSR m</th>
                <th className="p-3">Sprint m</th>
                <th className="p-3">Max km/h</th>
                <th className="p-3">Sprints</th>
                <th className="p-3">Load</th>
                <th className="p-3">Mins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3 font-medium">{nameOf(r)}</td>
                  <td className="p-3">{r.session_label ?? ''}</td>
                  <td className="p-3">{n(r.total_distance_m, 0)}</td>
                  <td className="p-3">{n(r.hsr_distance_m, 0)}</td>
                  <td className="p-3">{n(r.sprint_distance_m, 0)}</td>
                  <td className="p-3">{n(r.max_speed_kmh, 1)}</td>
                  <td className="p-3">{n(r.sprint_count, 0)}</td>
                  <td className="p-3">{n(r.player_load, 0)}</td>
                  <td className="p-3">{n(r.duration_mins, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-tranmere-blue">{value}</p>
    </div>
  )
}
