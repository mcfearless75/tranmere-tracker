'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { findNumberClashes, SQUAD_NUMBER_MAX, SQUAD_NUMBER_MIN } from '@/lib/gps/matchPods'
import type { ActionResult } from '@/lib/teams/types'

export type SquadNumberRow = {
  id: string
  name: string
  status: string
  shirt_number: number | null
  gps_number: number | null
}

type Props = {
  squad: SquadNumberRow[]
  save: (rows: { squadId: string; shirt: number | null; gps: number | null }[]) => Promise<ActionResult>
}

type Draft = { id: string; name: string; status: string; shirt: string; gps: string }

function toNumber(v: string): number | null {
  const t = v.trim()
  return t === '' ? null : Number(t)
}

function outOfRange(v: string): boolean {
  const n = toNumber(v)
  return n !== null && !(Number.isInteger(n) && n >= SQUAD_NUMBER_MIN && n <= SQUAD_NUMBER_MAX)
}

function sortRows(rows: Draft[]): Draft[] {
  return [...rows].sort((a, b) => {
    const an = toNumber(a.shirt) ?? Infinity
    const bn = toNumber(b.shirt) ?? Infinity
    return an - bn || a.name.localeCompare(b.name)
  })
}

/**
 * The paper "Catapult – GPS template", inside the app: shirt and pod against
 * each squad name for this match. The GPS import reads pods from here, so
 * "Tranmere P13" in the export resolves to whoever wore P13 in THIS match.
 *
 * The pod follows the shirt while the two are the same (the usual case) and
 * stops following once someone gives it a different number.
 */
export function SquadNumbersPanel({ squad, save }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<Draft[]>(() => sortRows(squad.map(s => ({
    id: s.id,
    name: s.name,
    status: s.status,
    shirt: s.shirt_number?.toString() ?? '',
    gps: s.gps_number?.toString() ?? '',
  }))))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const clashes = useMemo(() => findNumberClashes(rows.map(r => ({
    playerId: r.id,
    shirt: outOfRange(r.shirt) ? null : toNumber(r.shirt),
    gps: outOfRange(r.gps) ? null : toNumber(r.gps),
  }))), [rows])
  const invalid = rows.some(r => outOfRange(r.shirt) || outOfRange(r.gps))
  const blocked = invalid || clashes.shirt.size > 0 || clashes.gps.size > 0

  function update(id: string, field: 'shirt' | 'gps', value: string) {
    setMessage(null)
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      if (field === 'gps') return { ...r, gps: value }
      const podFollows = r.gps === '' || r.gps === r.shirt
      return { ...r, shirt: value, gps: podFollows ? value : r.gps }
    }))
  }

  function autoNumber() {
    setMessage(null)
    let n = 0
    setRows(prev => prev.map(r => {
      if (r.status === 'declined') return { ...r, shirt: '', gps: '' }
      n += 1
      return { ...r, shirt: String(n), gps: String(n) }
    }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const result = await save(rows.map(r => ({ squadId: r.id, shirt: toNumber(r.shirt), gps: toNumber(r.gps) })))
      if (result.ok) {
        setRows(prev => sortRows(prev))
        setMessage({ ok: true, text: 'Numbers saved' })
        router.refresh()
      } else {
        setMessage({ ok: false, text: result.error })
      }
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server — you may be offline. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (squad.length === 0) return null

  const cell = (bad: boolean) =>
    `w-16 rounded-md border px-2 py-1.5 text-center text-sm tabular-nums ${bad ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`

  return (
    <section className="bg-white rounded-xl border p-4 space-y-3" aria-labelledby="squad-numbers-heading">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 id="squad-numbers-heading" className="font-semibold">Shirt &amp; GPS numbers</h2>
          <p className="text-xs text-muted-foreground">
            The GPS pod is &ldquo;Tranmere P&lt;n&gt;&rdquo; in the Catapult export.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={autoNumber}>
          Auto-number 1…{rows.filter(r => r.status !== 'declined').length}
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="text-left font-medium pb-1">Shirt</th>
            <th className="text-left font-medium pb-1">GPS pod</th>
            <th className="text-left font-medium pb-1">Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.status === 'declined' ? 'opacity-50' : ''}>
              <td className="py-1 pr-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={SQUAD_NUMBER_MIN}
                  max={SQUAD_NUMBER_MAX}
                  aria-label={`Shirt number for ${r.name}`}
                  value={r.shirt}
                  onChange={e => update(r.id, 'shirt', e.target.value)}
                  className={cell(clashes.shirt.has(r.id) || outOfRange(r.shirt))}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={SQUAD_NUMBER_MIN}
                  max={SQUAD_NUMBER_MAX}
                  aria-label={`GPS pod for ${r.name}`}
                  value={r.gps}
                  onChange={e => update(r.id, 'gps', e.target.value)}
                  className={cell(clashes.gps.has(r.id) || outOfRange(r.gps))}
                />
              </td>
              <td className="py-1">
                {r.name}
                {r.status === 'declined' && <span className="ml-1 text-xs text-muted-foreground">(declined)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {blocked && (
        <p className="text-sm text-red-700">
          {invalid
            ? `Numbers must be ${SQUAD_NUMBER_MIN}–${SQUAD_NUMBER_MAX}.`
            : 'Two players share a number — fix the red boxes before saving.'}
        </p>
      )}
      {message && (
        <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>
      )}

      <Button type="button" onClick={handleSave} disabled={saving || blocked} className="bg-tranmere-blue text-white">
        {saving ? 'Saving…' : 'Save numbers'}
      </Button>
    </section>
  )
}
