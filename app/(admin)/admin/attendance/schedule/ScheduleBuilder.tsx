'use client'

import { useState, useCallback } from 'react'
import { Dumbbell, BookOpen, Trophy, Zap, CalendarDays, Loader2, CheckCircle2, X, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'

type SessionType = 'training' | 'lessons' | 'match' | 'gym'

interface SlotData {
  type: SessionType
  label: string
}

type Slots = Record<string, SlotData>

const DAYS = [
  { num: 1, short: 'Mon', full: 'Monday',    weekend: false },
  { num: 2, short: 'Tue', full: 'Tuesday',   weekend: false },
  { num: 3, short: 'Wed', full: 'Wednesday', weekend: false },
  { num: 4, short: 'Thu', full: 'Thursday',  weekend: false },
  { num: 5, short: 'Fri', full: 'Friday',    weekend: false },
  { num: 6, short: 'Sat', full: 'Saturday',  weekend: true  },
  { num: 0, short: 'Sun', full: 'Sunday',    weekend: true  },
]

const TYPES = [
  { type: 'training' as SessionType, label: 'Training', icon: Dumbbell, chip: 'bg-blue-500 text-white',   cell: 'bg-blue-50 border-blue-200 text-blue-700'   },
  { type: 'lessons'  as SessionType, label: 'Lessons',  icon: BookOpen, chip: 'bg-violet-500 text-white', cell: 'bg-violet-50 border-violet-200 text-violet-700' },
  { type: 'match'    as SessionType, label: 'Match',    icon: Trophy,   chip: 'bg-green-500 text-white',  cell: 'bg-green-50 border-green-200 text-green-700'  },
  { type: 'gym'      as SessionType, label: 'Gym',      icon: Zap,      chip: 'bg-orange-500 text-white', cell: 'bg-orange-50 border-orange-200 text-orange-700' },
]

function typeInfo(t: SessionType) {
  return TYPES.find(x => x.type === t) ?? TYPES[0]
}

function defaultLabel(type: SessionType, day: typeof DAYS[0], slot: 'am' | 'pm'): string {
  const slotName = slot === 'am' ? 'Morning' : 'Afternoon'
  return `${day.full} ${slotName} ${typeInfo(type).label}`
}

interface Props {
  templateId: string | null
  initialSlots: Slots
}

export function ScheduleBuilder({ templateId: initId, initialSlots }: Props) {
  const router = useRouter()
  const [slots, setSlots]         = useState<Slots>(initialSlots)
  const [dragType, setDragType]   = useState<SessionType | null>(null)
  const [dragOver, setDragOver]   = useState<string | null>(null)
  const [templateId, setTid]      = useState<string | null>(initId)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genMonth, setGenMonth]   = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [genResult, setGenResult] = useState<string | null>(null)

  const drop = useCallback((dayNum: number, slot: 'am' | 'pm', type: SessionType) => {
    const day = DAYS.find(d => d.num === dayNum)!
    setSlots(prev => ({ ...prev, [`${dayNum}_${slot}`]: { type, label: defaultLabel(type, day, slot) } }))
  }, [])

  const clear = useCallback((key: string) => {
    setSlots(prev => { const n = { ...prev }; delete n[key]; return n })
  }, [])

  const clearDay = useCallback((dayNum: number) => {
    setSlots(prev => {
      const n = { ...prev }
      delete n[`${dayNum}_am`]
      delete n[`${dayNum}_pm`]
      return n
    })
  }, [])

  const saveTemplate = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/attendance/save-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, slots }),
      })
      const data = await res.json()
      if (data.templateId) setTid(data.templateId)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
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
      const label = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
      setGenResult(`Created ${data.created} sessions for ${label}`)
      router.refresh()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Drag palette ── */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Drag onto the timetable below
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(({ type, label, icon: Icon, chip }) => (
            <div
              key={type}
              draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; setDragType(type) }}
              onDragEnd={() => { setDragType(null); setDragOver(null) }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing text-sm font-semibold select-none shadow-sm ${chip}`}
            >
              <Icon size={14} />
              {label}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Tip: click the <X size={10} className="inline" /> on a cell to remove it, or use the bin icon per day to clear the whole column.
        </p>
      </div>

      {/* ── Timetable grid ── */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2.5 w-14" />
              {DAYS.map(d => (
                <th key={d.num} className="px-1.5 py-2 w-[13%]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-xs font-bold ${d.weekend ? 'text-gray-400' : 'text-tranmere-blue'}`}>{d.short}</span>
                    {!d.weekend && (
                      <button
                        onClick={() => clearDay(d.num)}
                        title="Clear day"
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <RotateCcw size={10} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['am', 'pm'] as const).map((slot, si) => (
              <tr key={slot} className={si === 0 ? 'border-b' : ''}>
                <td className="px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  {slot === 'am' ? '🌅 AM' : '☀️ PM'}
                </td>
                {DAYS.map(day => {
                  const key = `${day.num}_${slot}`
                  const data = slots[key]
                  const info = data ? typeInfo(data.type) : null
                  const isOver = dragOver === key

                  return (
                    <td
                      key={day.num}
                      className={`px-1.5 py-2 ${day.weekend ? 'bg-gray-50/60' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(key) }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => {
                        e.preventDefault()
                        setDragOver(null)
                        if (dragType && !day.weekend) drop(day.num, slot, dragType)
                      }}
                    >
                      {data && info ? (
                        <div className={`relative rounded-lg border px-2 py-2 text-xs font-medium flex flex-col items-center gap-0.5 ${info.cell} transition-all`}>
                          <info.icon size={14} />
                          <span className="text-center leading-tight">{info.label}</span>
                          <button
                            onClick={() => clear(key)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border shadow flex items-center justify-center hover:bg-red-50 hover:border-red-300"
                          >
                            <X size={9} className="text-gray-500" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`rounded-lg border-2 border-dashed h-14 flex items-center justify-center text-xs transition-all
                            ${day.weekend ? 'border-gray-100 text-gray-200' : ''}
                            ${!day.weekend && isOver && dragType ? 'border-tranmere-blue bg-tranmere-blue/5 scale-105' : ''}
                            ${!day.weekend && !isOver ? 'border-gray-200 text-gray-300 hover:border-gray-300' : ''}
                          `}
                        >
                          {day.weekend ? 'off' : '+'}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Actions bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

        {/* Save template */}
        <button
          onClick={saveTemplate}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-tranmere-blue text-white text-sm font-semibold disabled:opacity-60 hover:bg-tranmere-blue/90 transition-colors shadow-sm"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : null}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Template'}
        </button>

        <div className="text-muted-foreground text-sm hidden sm:block">then</div>

        {/* Generate month */}
        <div className="flex items-center gap-2 bg-white border rounded-xl px-4 py-2 shadow-sm">
          <CalendarDays size={16} className="text-muted-foreground shrink-0" />
          <input
            type="month"
            value={genMonth}
            onChange={e => setGenMonth(e.target.value)}
            className="text-sm border-0 outline-none bg-transparent text-gray-700 w-36"
          />
          <button
            onClick={generateMonth}
            disabled={generating || !templateId}
            className="px-3 py-1.5 rounded-lg bg-tranmere-blue text-white text-sm font-semibold hover:bg-tranmere-blue/90 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            {generating && <Loader2 size={13} className="animate-spin" />}
            {generating ? 'Generating…' : 'Generate Month'}
          </button>
        </div>
      </div>

      {!templateId && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Save the template first, then you can generate sessions for any month.
        </p>
      )}

      {genResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{genResult} — sessions appear in the </span>
          <a href="/admin/attendance" className="underline font-semibold">Attendance list</a>
          <span>. Coaches open each one on the day to activate the PIN.</span>
        </div>
      )}
    </div>
  )
}
