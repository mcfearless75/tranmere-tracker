'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FootballPitch } from '@/components/pitch/FootballPitch'
import { FORMATIONS, FORMATION_NAMES, Slot } from '@/components/pitch/formations'
import { createClient } from '@/lib/supabase/client'
import { RotateCcw, Save, X, Check } from 'lucide-react'

type Student = { id: string; name: string; avatar_url: string | null }
type Match = { id: string; match_date: string; opponent: string; status: string }
type Placement = { slotId: string; playerId: string; playerName: string; avatarUrl?: string | null }

export function FormationBuilder({ students, matches, selectedMatchId, initialSquad }: {
  students: Student[]
  matches: Match[]
  selectedMatchId: string | null
  initialSquad: { player_id: string; position: string | null }[]
}) {
  const router = useRouter()
  const [formation, setFormation] = useState<string>('4-4-2')
  const [matchId, setMatchId] = useState<string | null>(selectedMatchId)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const slots: Slot[] = FORMATIONS[formation]

  // Restore from existing squad positions
  useEffect(() => {
    if (!initialSquad.length) return
    const restored: Placement[] = []
    for (const sq of initialSquad) {
      if (!sq.position) continue
      const slot = slots.find(s => s.id === sq.position)
      const player = students.find(s => s.id === sq.player_id)
      if (slot && player) {
        restored.push({ slotId: slot.id, playerId: player.id, playerName: player.name, avatarUrl: player.avatar_url })
      }
    }
    setPlacements(restored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSquad, formation])

  // When formation changes, clear slot selection and keep placements that still match
  useEffect(() => {
    setSelectedSlot(null)
    setPlacements(prev => prev.filter(p => slots.some(s => s.id === p.slotId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formation])

  const placedIds = new Set(placements.map(p => p.playerId))
  const available = students.filter(s => !placedIds.has(s.id))
  const placedBySlot = Object.fromEntries(placements.map(p => [p.slotId, p]))

  function placePlayer(student: Student) {
    if (!selectedSlot) {
      setMsg('Tap a position on the pitch first')
      setTimeout(() => setMsg(null), 2000)
      return
    }
    setPlacements(prev => {
      const filtered = prev.filter(p => p.slotId !== selectedSlot)
      return [...filtered, { slotId: selectedSlot, playerId: student.id, playerName: student.name, avatarUrl: student.avatar_url }]
    })
    // Advance to next empty slot
    const currentIdx = slots.findIndex(s => s.id === selectedSlot)
    const next = slots.find((s, i) => i > currentIdx && !placedBySlot[s.id])
    setSelectedSlot(next?.id ?? null)
  }

  function removePlacement(playerId: string) {
    setPlacements(prev => prev.filter(p => p.playerId !== playerId))
  }

  function reset() {
    setPlacements([])
    setSelectedSlot(null)
  }

  async function save() {
    if (!matchId) { setMsg('Pick a match to save to'); return }
    setSaving(true)
    setMsg(null)
    const supabase = createClient()

    // Update each placement's position on match_squads
    for (const p of placements) {
      await supabase
        .from('match_squads')
        .update({ position: p.slotId })
        .eq('match_id', matchId)
        .eq('player_id', p.playerId)
    }
    setSaving(false)
    setMsg(`Saved ${placements.length} position(s) to the match squad.`)
    setTimeout(() => setMsg(null), 3000)
    router.refresh()
  }

  // Assign shirt numbers by slot order
  const shirtNumbers: Record<string, number> = {}
  placements.forEach(p => {
    const idx = slots.findIndex(s => s.id === p.slotId)
    if (idx !== -1) shirtNumbers[p.playerId] = idx + 1
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* LEFT — Controls */}
      <div className="lg:col-span-2 space-y-4">
        {/* Formation picker */}
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Formation</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATION_NAMES.map(f => (
              <button
                key={f}
                onClick={() => setFormation(f)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  formation === f
                    ? 'bg-tranmere-blue text-white shadow'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Match picker */}
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Link to Match (optional)</p>
          <select
            value={matchId ?? ''}
            onChange={e => setMatchId(e.target.value || null)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">Not linked — scratch pad</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} vs {m.opponent}
                {m.status === 'completed' ? ' (completed)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1.5">
            When linked, positions save to the match squad.
          </p>
        </div>

        {/* Available players */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              Squad ({available.length} available)
            </p>
            {selectedSlot && (
              <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Tap a player →
              </p>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {available.map(s => {
              const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <button
                  key={s.id}
                  onClick={() => placePlayer(s)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-left transition"
                >
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                      {initials}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                </button>
              )
            })}
            {available.length === 0 && (
              <p className="text-xs text-muted-foreground p-4 text-center">All players placed ✓</p>
            )}
          </div>
        </div>

        {/* Placed list with remove */}
        {placements.length > 0 && (
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
              Starting XI ({placements.length}/{slots.length})
            </p>
            <div className="space-y-1">
              {placements
                .sort((a, b) => slots.findIndex(s => s.id === a.slotId) - slots.findIndex(s => s.id === b.slotId))
                .map(p => {
                  const slot = slots.find(s => s.id === p.slotId)
                  const num = shirtNumbers[p.playerId]
                  return (
                    <div key={p.playerId} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                        {num}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{p.playerName}</span>
                      <span className="text-xs text-muted-foreground">{slot?.role}</span>
                      <button
                        onClick={() => removePlacement(p.playerId)}
                        className="text-red-500 hover:bg-red-50 rounded p-0.5"
                        aria-label="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={save}
            disabled={saving || !matchId || placements.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-tranmere-blue text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-900 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save to Match'}
          </button>
        </div>
        {msg && (
          <div className="rounded-lg bg-green-50 text-green-800 text-sm p-3 flex items-center gap-2">
            <Check size={14} /> {msg}
          </div>
        )}
      </div>

      {/* RIGHT — Pitch */}
      <div className="lg:col-span-3">
        <div className="sticky top-6">
          <FootballPitch
            slots={slots}
            placements={placements}
            selectedSlot={selectedSlot}
            onSlotClick={id => setSelectedSlot(id === selectedSlot ? null : id)}
            onPlacementClick={removePlacement}
            numberByPlayerId={shirtNumbers}
          />
          <p className="text-center text-xs text-muted-foreground mt-2">
            Tap a position to select it (turns orange) · tap a filled player to remove them
          </p>
        </div>
      </div>
    </div>
  )
}
