'use client'

import { useState } from 'react'
import {
  Dumbbell, BookOpen, Trophy, Zap, CalendarDays,
  Loader2, CheckCircle2, Plus, Trash2, GraduationCap,
  BarChart2, MessageSquare
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type SessionType = 'training' | 'lessons' | 'match' | 'gym' | 'btec' | 'gcse' | 'tutorial' | 'analysis'

interface Slot {
  startTime: string
  endTime: string
  type: SessionType
  label: string
}

type DaySlots = Record<number, Slot[]>

export interface ScheduleSlot {
  day_of_week: number
  slot_order: number
  start_time: string
  end_time: string
  session_type: string
  session_label: string
}

const WEEKDAYS = [
  { num: 1, short: 'Mon', full: 'Monday'    },
  { num: 2, short: 'Tue', full: 'Tuesday'   },
  { num: 3, short: 'Wed', full: 'Wednesday' },
  { num: 4, short: 'Thu', full: 'Thursday'  },
  { num: 5, short: 'Fri', full: 'Friday'    },
]

const TYPES = [
  { type: 'btec'     as SessionType, label: 'BTEC',     Icon: BookOpen,       chip: 'bg-violet-500 text-white', cell: 'border-violet-200 bg-violet-50 text-violet-800'   },
  { type: 'training' as SessionType, label: 'Training', Icon: Dumbbell,       chip: 'bg-blue-500 text-white',   cell: 'border-blue-200 bg-blue-50 text-blue-800'         },
  { type: 'match'    as SessionType, label: 'Match',    Icon: Trophy,         chip: 'bg-green-500 text-white',  cell: 'border-green-200 bg-green-50 text-green-800'      },
  { type: 'gym'      as SessionType, label: 'Gym',      Icon: Zap,            chip: 'bg-orange-500 text-white', cell: 'border-orange-200 bg-orange-50 text-orange-800'   },
  { type: 'gcse'     as SessionType, label: 'GCSE',     Icon: GraduationCap,  chip: 'bg-red-500 text-white',    cell: 'border-red-200 bg-red-50 text-red-800'            },
  { type: 'tutorial' as SessionType, label: 'Tutorial', Icon: MessageSquare,  chip: 'bg-teal-500 text-white',   cell: 'border-teal-200 bg-teal-50 text-teal-800'         },
  { type: 'analysis' as SessionType, label: 'Analysis', Icon: BarChart2,      chip: 'bg-indigo-500 text-white', cell: 'border-indigo-200 bg-indigo-50 text-indigo-800'   },
  { type: 'lessons'  as SessionType, label: 'Lessons',  Icon: BookOpen,       chip: 'bg-purple-500 text-white', cell: 'border-purple-200 bg-purple-50 text-purple-800'   },
]

function tInfo(t: SessionType) { return TYPES.find(x => x.type === t) ?? TYPES[0] }
const emptyForm = (): { startTime: string; endTime: string; type: SessionType; label: string } =>
  ({ startTime: '', endTime: '', type: 'btec', label: '' })

function fromDb(dbSlots: ScheduleSlot[]): DaySlots {
  const result: DaySlots = {}
  for (const s of dbSlots) {
    if (!result[s.day_of_week]) result[s.day_of_week] = []
    result[s.day_of_week].push({
      startTime: s.start_time.substring(0, 5),
      endTime:   s.end_time.substring(0, 5),
      type:      s.session_type as SessionType,
      label:     s.session_label,
    })
  }
  for (const day of Object.keys(result)) {
    result[+day].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }
  return result
}

interface Props {
  templateId: string | null
  initialSlots: ScheduleSlot[]
}

export function ScheduleBuilder({ templateId: initId, initialSlots }: Props) {
  const router = useRouter()
  const [activeDay, setActiveDay] = useState(1)
  const [slots, setSlots]         = useState<DaySlots>(() => fromDb(initialSlots))
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const [templateId, setTid]      = useState<string | null>(initId)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genMonth, setGenMonth]   = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [genResult, setGenResult] = useState<string | null>(null)

  const daySlots = slots[activeDay] ?? []

  const removeSlot = (idx: number) =>
    setSlots(prev => ({ ...prev, [activeDay]: (prev[activeDay] ?? []).filter((_, i) => i !== idx) }))

  const confirmAdd = () => {
    if (!form.startTime || !form.endTime) return
    const label = form.label.trim() || tInfo(form.type).label
    setSlots(prev => {
      const updated = [...(prev[activeDay] ?? []), { ...form, label }]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
      return { ...prev, [activeDay]: updated }
    })
    setAdding(false)
    setForm(emptyForm())
  }

  const saveTemplate = async () => {
    setSaving(true); setSaved(false)
    const payload: Record<string, { type: string; label: string; startTime: string; endTime: string }[]> = {}
    for (const [day, dayData] of Object.entries(slots)) {
      payload[day] = dayData.map(s => ({ type: s.type, label: s.label, startTime: s.startTime, endTime: s.endTime }))
    }
    try {
      const res = await fetch('/api/attendance/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, slots: payload }),
      })
      const data = await res.json()
      if (data.templateId) setTid(data.templateId)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const generateMonth = async () => {
    if (!templateId) { alert('Save the template first'); return }
    setGenerating(true); setGenResult(null)
    try {
      const [year, month] = genMonth.split('-').map(Number)
      const res = await fetch('/api/attendance/generate-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, year, month }),
      })
      const data = await res.json()
      const lbl = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
      setGenResult(`✓ Created ${data.created} sessions for ${lbl}`)
      router.refresh()
    } finally { setGenerating(false) }
  }

  const activeDayInfo = WEEKDAYS.find(d => d.num === activeDay)!
  const isMatchDay = activeDay === 3

  return (
    <div className="space-y-5">

      {/* ── Day tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {WEEKDAYS.map(d => {
          const count = (slots[d.num] ?? []).length
          const isWed = d.num === 3
          return (
            <button
              key={d.num}
              onClick={() => { setActiveDay(d.num); setAdding(false); setForm(emptyForm()) }}
              className={`flex-1 flex flex-col items-center py-2 rounded-lg text-sm font-semibold transition-all
                ${activeDay === d.num ? 'bg-white shadow text-tranmere-blue' : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <span>{d.short}</span>
              {count > 0
                ? <span className="text-[10px] font-normal text-muted-foreground">{count} sessions</span>
                : isWed
                  ? <span className="text-[10px] text-green-500">⚽ Match</span>
                  : <span className="text-[10px] text-gray-300">—</span>
              }
            </button>
          )
        })}
      </div>

      {/* ── Day card ── */}
      <div className="bg-white rounded-xl border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="font-bold text-tranmere-blue">{activeDayInfo.full}</h3>
            <p className="text-xs text-muted-foreground">
              {daySlots.length} session{daySlots.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
          {isMatchDay && daySlots.length === 0 && (
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium">
              ⚽ Game Day
            </span>
          )}
        </div>

        <div className="p-4 space-y-2">
          {daySlots.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isMatchDay
                ? 'Match day — no sessions needed, or add a warm-up / debrief below.'
                : 'No sessions yet. Add one below.'}
            </p>
          )}

          {daySlots.map((slot, idx) => {
            const info = tInfo(slot.type)
            return (
              <div key={idx} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${info.cell}`}>
                <span className="text-xs font-mono font-bold tabular-nums shrink-0 text-gray-600 w-24">
                  {slot.startTime}–{slot.endTime}
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <info.Icon size={13} />
                  <span className="text-sm font-semibold truncate">{slot.label}</span>
                </div>
                <button onClick={() => removeSlot(idx)} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}

          {/* ── Add slot form ── */}
          {adding ? (
            <div className="border rounded-xl p-4 bg-gray-50 space-y-4 mt-2">
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Start time</label>
                  <input type="time" value={form.startTime}
                    onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                    className="text-sm border rounded-lg px-3 py-2 bg-white" />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">End time</label>
                  <input type="time" value={form.endTime}
                    onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                    className="text-sm border rounded-lg px-3 py-2 bg-white" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Session type</label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map(({ type, label, Icon, chip }) => (
                    <button key={type}
                      onClick={() => setForm(p => ({ ...p, type, label: p.label || label }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        form.type === type ? chip + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      <Icon size={11} />{label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Label <span className="font-normal">(e.g. &quot;Maths GCSE&quot; or &quot;Eng GCSE&quot;)</span>
                </label>
                <input type="text" value={form.label}
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder={tInfo(form.type).label}
                  className="text-sm border rounded-lg px-3 py-2 bg-white" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={confirmAdd}
                  disabled={!form.startTime || !form.endTime}
                  className="flex-1 py-2 bg-tranmere-blue text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-tranmere-blue/90">
                  Add Session
                </button>
                <button onClick={() => { setAdding(false); setForm(emptyForm()) }}
                  className="px-4 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-muted-foreground hover:border-tranmere-blue/40 hover:text-tranmere-blue transition-colors justify-center mt-2">
              <Plus size={15} />
              Add Session
            </button>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center pt-1">
        <button onClick={saveTemplate} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-tranmere-blue text-white text-sm font-semibold disabled:opacity-60 hover:bg-tranmere-blue/90 shadow-sm">
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : null}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Template'}
        </button>

        <span className="text-muted-foreground text-sm hidden sm:block">then</span>

        <div className="flex items-center gap-2 bg-white border rounded-xl px-4 py-2 shadow-sm">
          <CalendarDays size={16} className="text-muted-foreground shrink-0" />
          <input type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)}
            className="text-sm border-0 outline-none bg-transparent text-gray-700 w-36" />
          <button onClick={generateMonth} disabled={generating || !templateId}
            className="px-3 py-1.5 rounded-lg bg-tranmere-blue text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5 hover:bg-tranmere-blue/90">
            {generating && <Loader2 size={13} className="animate-spin" />}
            {generating ? 'Generating…' : 'Generate Month'}
          </button>
        </div>
      </div>

      {!templateId && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Save the template first — then you can generate sessions for any month.
        </p>
      )}

      {genResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0" />
          {genResult} — Coaches open each session on the day to activate the PIN.{' '}
          <a href="/admin/attendance" className="underline font-semibold">View sessions →</a>
        </div>
      )}
    </div>
  )
}
