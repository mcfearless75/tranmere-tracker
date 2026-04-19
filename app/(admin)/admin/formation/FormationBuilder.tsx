'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FootballPitch } from '@/components/pitch/FootballPitch'
import { FORMATIONS, FORMATION_NAMES, Slot } from '@/components/pitch/formations'
import { createClient } from '@/lib/supabase/client'
import { RotateCcw, Save, X, Check, Users } from 'lucide-react'

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

  useEffect(() => {
    setSelectedSlot(null)
    setPlacements(prev => prev.filter(p => slots.some(s => s.id === p.slotId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formation])

  const placedIds = new Set(placements.map(p => p.playerId))
  const available = students.filter(s => !placedIds.has(s.id))
  const placedBySlot = Object.fromEntries(placements.map(p => [p.slotId, p]))
  const selectedSlotRole = slots.find(s => s.id === selectedSlot)?.role

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
    for (const p of placements) {
      await supabase
        .from('match_squads')
        .update({ position: p.slotId })
        .eq('match_id', matchId)
        .eq('player_id', p.playerId)
    }
    setSaving(false)
    setMsg(`Saved ${placements.length} position(s)`)
    setTimeout(() => setMsg(null), 3000)
    router.refresh()
  }

  const shirtNumbers: Record<string, number> = {}
  placements.forEach(p => {
    const idx = slots.findIndex(s => s.id === p.slotId)
    if (idx !== -1) shirtNumbers[p.playerId] = idx + 1
  })

  return (
    <div className="space-y-4 pb-24 lg:pb-4">
      {/* FORMATION PILLS — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1">
        {FORMATION_NAMES.map(f => (
          <button
            key={f}
            onClick={() => setFormation(f)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              formation === f
                ? 'bg-tranmere-blue text-white shadow-md scale-105'
                : 'bg-white text-gray-700 border border-gray-200 active:bg-gray-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* DESKTOP: 2-col split · MOBILE: pitch on top, controls below */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* PITCH — first on mobile, right on desktop */}
        <div className="lg:col-span-3 lg:order-2">
          <div className="lg:sticky lg:top-6">
            <div className="rounded-2xl overflow-hidden shadow-xl relative">
              <FootballPitch
                slots={slots}
                placements={placements}
                selectedSlot={selectedSlot}
                onSlotClick={id => setSelectedSlot(id === selectedSlot ? null : id)}
                onPlacementClick={removePlacement}
                numberByPlayerId={shirtNumbers}
              />
              {/* Hint overlay at bottom of pitch */}
              {selectedSlot && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur rounded-xl px-3 py-2 text-white text-xs font-semibold text-center shadow-lg animate-pulse">
                  Pick a player to place at <span className="text-orange-300">{selectedSlotRole}</span> ↓
                </div>
              )}
            </div>

            {/* Starting XI compact summary under pitch */}
            <div className="mt-3 rounded-2xl border bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Starting XI · {placements.length}/{slots.length}
                </p>
                {placements.length > 0 && (
                  <button
                    onClick={reset}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
              </div>
              {placements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Tap a position on the pitch to begin</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {placements
                    .sort((a, b) => slots.findIndex(s => s.id === a.slotId) - slots.findIndex(s => s.id === b.slotId))
                    .map(p => {
                      const slot = slots.find(s => s.id === p.slotId)
                      const num = shirtNumbers[p.playerId]
                      const shortName = p.playerName.split(' ').slice(-1)[0]
                      return (
                        <button
                          key={p.playerId}
                          onClick={() => removePlacement(p.playerId)}
                          className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-left"
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                            {num}
                          </span>
                          <span className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{shortName}</p>
                            <p className="text-[10px] text-muted-foreground">{slot?.role}</p>
                          </span>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CONTROLS — second on mobile, left on desktop */}
        <div className="lg:col-span-2 lg:order-1 space-y-3">
          {/* Match picker */}
          <div className="rounded-2xl border bg-white p-3">
            <label className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Link to Match</label>
            <select
              value={matchId ?? ''}
              onChange={e => setMatchId(e.target.value || null)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white mt-1"
            >
              <option value="">Not linked · scratch pad</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} vs {m.opponent}
                </option>
              ))}
            </select>
          </div>

          {/* Squad chips grid — tappable, big touch targets */}
          <div className="rounded-2xl border bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
                <Users size={12} /> Squad ({available.length} available)
              </p>
              {selectedSlot && (
                <span className="flex items-center gap-1 text-[10px] text-orange-600 font-semibold">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Pick a player
                </span>
              )}
            </div>
            {available.length === 0 ? (
              <div className="py-6 text-center">
                <Check size={24} className="mx-auto text-green-500 mb-1" />
                <p className="text-xs text-muted-foreground">All players placed</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {available.map(s => {
                  const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  const shortName = s.name.split(' ').slice(-1)[0]
                  const disabled = !selectedSlot
                  return (
                    <button
                      key={s.id}
                      onClick={() => placePlayer(s)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all active:scale-95 ${
                        disabled
                          ? 'border-gray-200 bg-gray-50 opacity-50'
                          : 'border-tranmere-blue bg-blue-50 hover:bg-blue-100 active:bg-blue-200 shadow-sm'
                      }`}
                    >
                      {s.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                          {initials}
                        </span>
                      )}
                      <span className="flex-1 text-sm font-semibold truncate">{shortName}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {msg && (
            <div className="rounded-xl bg-green-50 text-green-800 text-sm p-3 flex items-center gap-2">
              <Check size={14} /> {msg}
            </div>
          )}
        </div>
      </div>

      {/* STICKY SAVE BAR (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden z-30 bg-gradient-to-t from-white via-white to-transparent pb-3 pt-6 px-4 pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto flex gap-2">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold active:bg-gray-100"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={save}
            disabled={saving || !matchId || placements.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 text-sm font-bold shadow-lg disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : matchId ? `Save ${placements.length}/${slots.length} to Match` : 'Pick match first'}
          </button>
        </div>
      </div>

      {/* DESKTOP save button (inline) */}
      <div className="hidden lg:block">
        <button
          onClick={save}
          disabled={saving || !matchId || placements.length === 0}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 font-bold shadow-lg disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Saving…' : matchId ? `Save Formation to Match` : 'Pick match to save'}
        </button>
      </div>
    </div>
  )
}
