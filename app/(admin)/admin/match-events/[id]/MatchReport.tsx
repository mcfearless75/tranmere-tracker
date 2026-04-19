'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Crown, CheckCircle2, XCircle, Clock, Save, Bell, Check, Target, Shield } from 'lucide-react'

type Match = {
  id: string
  match_date: string
  opponent: string
  location: string | null
  notes: string | null
  status: string
  home_score: number | null
  away_score: number | null
  motm_player_id: string | null
  report_text: string | null
  lessons_learned: string | null
}

type SquadRow = {
  id: string
  player_id: string
  status: string
  position: string | null
  coach_rating: number | null
  coach_notes: string | null
  goals: number | null
  assists: number | null
  minutes_played: number | null
  yellow_card: boolean
  red_card: boolean
  users: { name: string; avatar_url: string | null } | null
}

const statusIcon = (s: string) =>
  s === 'accepted' ? <CheckCircle2 size={14} className="text-green-500" /> :
  s === 'declined' ? <XCircle size={14} className="text-red-400" /> :
  <Clock size={14} className="text-amber-400" />

export function MatchReport({ match, squad }: { match: Match; squad: SquadRow[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const supabase = createClient()

  // Match report state
  const [homeScore, setHomeScore] = useState<number | ''>(match.home_score ?? '')
  const [awayScore, setAwayScore] = useState<number | ''>(match.away_score ?? '')
  const [motm, setMotm] = useState<string>(match.motm_player_id ?? '')
  const [reportText, setReportText] = useState(match.report_text ?? '')
  const [lessons, setLessons] = useState(match.lessons_learned ?? '')
  const [status, setStatus] = useState(match.status)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Per-squad-row state
  type RowState = Partial<SquadRow>
  const [rowEdits, setRowEdits] = useState<Record<string, RowState>>({})
  const [rowSaving, setRowSaving] = useState<string | null>(null)

  const accepted = squad.filter(s => s.status === 'accepted')
  const declined = squad.filter(s => s.status === 'declined')
  const pending = squad.filter(s => s.status === 'invited')

  // Stats
  const totalGoals = squad.reduce((sum, s) => sum + (rowEdits[s.id]?.goals ?? s.goals ?? 0), 0)
  const totalAssists = squad.reduce((sum, s) => sum + (rowEdits[s.id]?.assists ?? s.assists ?? 0), 0)
  const avgRating = (() => {
    const rated = squad.filter(s => (rowEdits[s.id]?.coach_rating ?? s.coach_rating) != null)
    if (rated.length === 0) return null
    const sum = rated.reduce((t, s) => t + ((rowEdits[s.id]?.coach_rating ?? s.coach_rating) ?? 0), 0)
    return sum / rated.length
  })()

  // Match result (from home/away POV — we're home by convention)
  const result = (() => {
    const h = homeScore === '' ? null : Number(homeScore)
    const a = awayScore === '' ? null : Number(awayScore)
    if (h == null || a == null) return null
    if (h > a) return { label: 'Win', colour: 'bg-green-100 text-green-700' }
    if (h < a) return { label: 'Loss', colour: 'bg-red-100 text-red-700' }
    return { label: 'Draw', colour: 'bg-gray-100 text-gray-700' }
  })()

  function updateRow(id: string, patch: Partial<SquadRow>) {
    setRowEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function saveRow(id: string) {
    const patch = rowEdits[id]
    if (!patch) return
    setRowSaving(id)
    await supabase.from('match_squads').update(patch).eq('id', id)
    setRowSaving(null)
    startTransition(() => router.refresh())
  }

  async function saveReport() {
    setSaving(true)
    setSaveMsg(null)
    await supabase.from('match_events').update({
      home_score: homeScore === '' ? null : Number(homeScore),
      away_score: awayScore === '' ? null : Number(awayScore),
      motm_player_id: motm || null,
      report_text: reportText || null,
      lessons_learned: lessons || null,
      status,
      report_updated_at: new Date().toISOString(),
    }).eq('id', match.id)
    setSaving(false)
    setSaveMsg('Match report saved')
    setTimeout(() => setSaveMsg(null), 3000)
    startTransition(() => router.refresh())
  }

  async function publishToPlayers() {
    if (!confirm(`Send a push notification to ${accepted.length} squad player(s) with the match result?`)) return
    const title = `Match Report — vs ${match.opponent}`
    const h = homeScore === '' ? 0 : Number(homeScore)
    const a = awayScore === '' ? 0 : Number(awayScore)
    const body = `Tranmere ${h}–${a} ${match.opponent}. Check your stats and coach feedback in the app.`

    for (const s of accepted) {
      await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: s.player_id, title, body, url: '/matches' }),
      })
    }
    setSaveMsg(`Notifications sent to ${accepted.length} player(s)`)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const motmPlayer = squad.find(s => s.player_id === motm)?.users

  return (
    <div className="space-y-5">
      {/* SCOREBOARD HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-tranmere-blue via-blue-800 to-indigo-900 p-5 sm:p-6 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-200">
                {new Date(match.match_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {match.location && <p className="text-sm text-blue-200">{match.location}</p>}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="rounded-full bg-white/15 text-white text-xs px-3 py-1 backdrop-blur border border-white/20"
              >
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {result && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${result.colour}`}>{result.label}</span>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <div>
              <p className="text-lg sm:text-xl font-bold">Tranmere</p>
              <input
                type="number"
                min={0}
                value={homeScore}
                onChange={e => setHomeScore(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                placeholder="—"
                className="w-full mt-2 text-5xl sm:text-7xl font-bold bg-transparent text-center outline-none border-b-2 border-white/20 focus:border-white"
              />
            </div>
            <div className="text-2xl sm:text-4xl text-white/50 font-light">vs</div>
            <div>
              <p className="text-lg sm:text-xl font-bold truncate">{match.opponent}</p>
              <input
                type="number"
                min={0}
                value={awayScore}
                onChange={e => setAwayScore(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                placeholder="—"
                className="w-full mt-2 text-5xl sm:text-7xl font-bold bg-transparent text-center outline-none border-b-2 border-white/20 focus:border-white"
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-200">Goals (squad)</p>
              <p className="text-xl font-bold">{totalGoals}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-200">Assists</p>
              <p className="text-xl font-bold">{totalAssists}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-blue-200">Avg Rating</p>
              <p className="text-xl font-bold">{avgRating ? avgRating.toFixed(1) : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAN OF THE MATCH */}
      <div className="rounded-2xl border bg-gradient-to-r from-amber-50 to-yellow-50 p-4 sm:p-5 border-amber-200">
        <p className="flex items-center gap-2 font-semibold text-amber-800 mb-3">
          <Crown size={18} /> Man of the Match
        </p>
        <select
          value={motm}
          onChange={e => setMotm(e.target.value)}
          className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">— not yet selected —</option>
          {accepted.map(s => (
            <option key={s.player_id} value={s.player_id}>
              {s.users?.name}
            </option>
          ))}
        </select>
        {motmPlayer && (
          <div className="mt-3 flex items-center gap-3 bg-white rounded-xl p-3 border border-amber-200">
            {motmPlayer.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={motmPlayer.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-300" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold">
                {motmPlayer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <div>
              <p className="font-bold">{motmPlayer.name}</p>
              <p className="text-xs text-amber-700">🏆 Player of the Match</p>
            </div>
          </div>
        )}
      </div>

      {/* PLAYER STATS GRID */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Squad &amp; Player Stats</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rate each player and record their goals, assists, and minutes played.
          </p>
        </div>

        {accepted.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 pt-3">Played ({accepted.length})</p>
            <div className="divide-y">
              {accepted.map(s => {
                const e = rowEdits[s.id] ?? {}
                const rating = e.coach_rating ?? s.coach_rating ?? ''
                const goals = e.goals ?? s.goals ?? 0
                const assists = e.assists ?? s.assists ?? 0
                const mins = e.minutes_played ?? s.minutes_played ?? ''
                const notes = e.coach_notes ?? s.coach_notes ?? ''
                const yc = e.yellow_card ?? s.yellow_card
                const rc = e.red_card ?? s.red_card
                const isMotm = motm === s.player_id
                const dirty = Object.keys(rowEdits[s.id] ?? {}).length > 0

                return (
                  <div key={s.id} className={`p-3 sm:p-4 ${isMotm ? 'bg-amber-50/50' : ''}`}>
                    <div className="flex items-center gap-3 mb-3">
                      {s.users?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.users.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-tranmere-blue flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(s.users?.name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link href={`/admin/students/${s.player_id}`} className="font-semibold text-tranmere-blue hover:underline">
                          {s.users?.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {statusIcon(s.status)}
                          {s.position && <span className="font-mono bg-gray-100 px-1.5 rounded">{s.position}</span>}
                          {isMotm && <span className="text-amber-600 font-semibold flex items-center gap-0.5"><Crown size={11} /> MOTM</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-2">
                      <LabelField label="Rating">
                        <select
                          value={rating}
                          onChange={ev => updateRow(s.id, { coach_rating: ev.target.value === '' ? null : Number(ev.target.value) })}
                          className="w-full text-sm border rounded px-2 py-1 bg-white"
                        >
                          <option value="">—</option>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </LabelField>
                      <LabelField label="Goals">
                        <input
                          type="number" min={0}
                          value={goals}
                          onChange={ev => updateRow(s.id, { goals: Number(ev.target.value) || 0 })}
                          className="w-full text-sm border rounded px-2 py-1"
                        />
                      </LabelField>
                      <LabelField label="Assists">
                        <input
                          type="number" min={0}
                          value={assists}
                          onChange={ev => updateRow(s.id, { assists: Number(ev.target.value) || 0 })}
                          className="w-full text-sm border rounded px-2 py-1"
                        />
                      </LabelField>
                      <LabelField label="Mins">
                        <input
                          type="number" min={0} max={120}
                          value={mins}
                          onChange={ev => updateRow(s.id, { minutes_played: ev.target.value === '' ? null : Number(ev.target.value) })}
                          className="w-full text-sm border rounded px-2 py-1"
                          placeholder="90"
                        />
                      </LabelField>
                      <LabelField label="YC">
                        <button
                          onClick={() => updateRow(s.id, { yellow_card: !yc })}
                          className={`w-full h-[34px] rounded border text-sm font-semibold ${yc ? 'bg-yellow-400 text-white border-yellow-500' : 'bg-white text-gray-400'}`}
                        >
                          {yc ? '●' : '—'}
                        </button>
                      </LabelField>
                      <LabelField label="RC">
                        <button
                          onClick={() => updateRow(s.id, { red_card: !rc })}
                          className={`w-full h-[34px] rounded border text-sm font-semibold ${rc ? 'bg-red-500 text-white border-red-600' : 'bg-white text-gray-400'}`}
                        >
                          {rc ? '●' : '—'}
                        </button>
                      </LabelField>
                    </div>

                    <textarea
                      placeholder="Coach notes for this player (feedback, what to work on, moments of quality…)"
                      value={notes}
                      onChange={ev => updateRow(s.id, { coach_notes: ev.target.value })}
                      rows={2}
                      className="w-full text-sm border rounded px-2 py-1.5 resize-none"
                    />

                    {dirty && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => saveRow(s.id)}
                          disabled={rowSaving === s.id}
                          className="inline-flex items-center gap-1.5 bg-tranmere-blue text-white rounded-lg px-3 py-1 text-xs font-semibold hover:bg-blue-900 disabled:opacity-50"
                        >
                          {rowSaving === s.id ? 'Saving…' : <><Check size={12} /> Save</>}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {declined.length > 0 && (
          <div className="p-4 border-t bg-gray-50/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Declined ({declined.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {declined.map(s => (
                <Link key={s.id} href={`/admin/students/${s.player_id}`} className="text-xs bg-white border border-red-200 text-red-700 rounded-full px-2 py-0.5 hover:border-red-400">
                  {s.users?.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div className="p-4 border-t bg-amber-50/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Still pending ({pending.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {pending.map(s => (
                <Link key={s.id} href={`/admin/students/${s.player_id}`} className="text-xs bg-white border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 hover:border-amber-400">
                  {s.users?.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MATCH REPORT — narrative + lessons */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-1.5">
          <Target size={16} className="text-tranmere-blue" />
          Coach&apos;s Match Report
        </h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Match report / narrative</label>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            rows={6}
            placeholder="How did the match unfold? Key moments, tactical observations, what worked, what didn't…"
            className="w-full text-sm border rounded-lg px-3 py-2 resize-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Shield size={12} /> Lessons learned &amp; action points
          </label>
          <textarea
            value={lessons}
            onChange={e => setLessons(e.target.value)}
            rows={4}
            placeholder="What do we work on next training? E.g. defending set pieces, transition play, pressing triggers…"
            className="w-full text-sm border rounded-lg px-3 py-2 resize-none"
          />
        </div>
      </div>

      {/* SAVE + PUBLISH */}
      <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent p-4 -mx-4 sm:-mx-6">
        <div className="flex flex-col sm:flex-row gap-2 max-w-md sm:max-w-full mx-auto">
          <button
            onClick={saveReport}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-tranmere-blue text-white px-4 py-3 font-semibold shadow-lg hover:bg-blue-900 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Match Report'}
          </button>
          {status === 'completed' && accepted.length > 0 && (
            <button
              onClick={publishToPlayers}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white border-2 border-tranmere-blue text-tranmere-blue px-4 py-3 font-semibold hover:bg-blue-50"
            >
              <Bell size={16} />
              Notify Players ({accepted.length})
            </button>
          )}
        </div>
        {saveMsg && (
          <div className="mt-2 text-center rounded-lg bg-green-50 text-green-800 text-sm p-2 flex items-center justify-center gap-1.5">
            <Check size={14} /> {saveMsg}
          </div>
        )}
      </div>
    </div>
  )
}

function LabelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-0.5">{label}</label>
      {children}
    </div>
  )
}
