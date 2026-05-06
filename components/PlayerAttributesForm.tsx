'use client'

import { useState, useTransition } from 'react'
import { savePlayerAttributes } from '@/app/(student)/profile/player-attributes-actions'
import { Calendar, Footprints, Ruler, Weight, User2, Activity } from 'lucide-react'

export type PlayerAttributes = {
  date_of_birth: string | null
  position:      string | null
  height_cm:     number | null
  weight_kg:     number | null
  build:         string | null
  dominant_foot: string | null
}

const POSITIONS = [
  'Goalkeeper', 'Centre-Back', 'Full-Back', 'Wing-Back',
  'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder',
  'Winger', 'Striker', 'Forward',
]
const BUILDS  = ['Slim', 'Athletic', 'Stocky', 'Heavy']
const FEET    = ['Left', 'Right', 'Both']

function calcAge(dob: string | null) {
  if (!dob) return null
  const b = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export function PlayerAttributesForm({
  attributes,
  userId,            // omit when student is editing their own
  title = 'Player Profile',
}: {
  attributes: PlayerAttributes
  userId?: string
  title?: string
}) {
  const [form, setForm]       = useState<PlayerAttributes>(attributes)
  const [editing, setEditing] = useState(false)
  const [pending, start]      = useTransition()
  const [msg, setMsg]         = useState<string | null>(null)

  const age = calcAge(form.date_of_birth)

  function save() {
    setMsg(null)
    start(async () => {
      const res = await savePlayerAttributes({
        userId,
        date_of_birth: form.date_of_birth,
        position:      form.position,
        height_cm:     form.height_cm,
        weight_kg:     form.weight_kg,
        build:         form.build,
        dominant_foot: form.dominant_foot,
      })
      if (res.ok) { setEditing(false); setMsg('Saved') }
      else        setMsg(res.error ?? 'Save failed')
    })
  }

  // ── Read view ─────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-tranmere-blue flex items-center gap-1.5">
            <User2 size={16} /> {title}
          </h3>
          <button onClick={() => setEditing(true)} className="text-xs text-tranmere-blue underline underline-offset-2 hover:no-underline">
            Edit
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat icon={<Calendar size={14} />}   label="Age"           value={age !== null ? `${age}` : '—'} />
          <Stat icon={<Activity size={14} />}   label="Position"      value={form.position ?? '—'} highlighted={!!form.position} />
          <Stat icon={<Footprints size={14} />} label="Foot"          value={form.dominant_foot ?? '—'} />
          <Stat icon={<Ruler size={14} />}      label="Height"        value={form.height_cm ? `${form.height_cm} cm` : '—'} />
          <Stat icon={<Weight size={14} />}     label="Weight"        value={form.weight_kg ? `${form.weight_kg} kg` : '—'} />
          <Stat icon={<User2 size={14} />}      label="Build"         value={form.build ?? '—'} />
        </div>

        {msg && <p className="text-xs text-green-600">{msg}</p>}
      </div>
    )
  }

  // ── Edit view ─────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4">
      <h3 className="font-semibold text-tranmere-blue flex items-center gap-1.5">
        <User2 size={16} /> Edit {title}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Date of birth">
          <input
            type="date"
            value={form.date_of_birth ?? ''}
            onChange={e => setForm({ ...form, date_of_birth: e.target.value || null })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Position">
          <select
            value={form.position ?? ''}
            onChange={e => setForm({ ...form, position: e.target.value || null })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">—</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="Height (cm)">
          <input
            type="number" min={100} max={230}
            value={form.height_cm ?? ''}
            onChange={e => setForm({ ...form, height_cm: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Weight (kg)">
          <input
            type="number" min={30} max={200} step="0.1"
            value={form.weight_kg ?? ''}
            onChange={e => setForm({ ...form, weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Build">
          <select
            value={form.build ?? ''}
            onChange={e => setForm({ ...form, build: e.target.value || null })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">—</option>
            {BUILDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="Dominant foot">
          <select
            value={form.dominant_foot ?? ''}
            onChange={e => setForm({ ...form, dominant_foot: e.target.value || null })}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">—</option>
            {FEET.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          disabled={pending}
          className="flex-1 sm:flex-none bg-tranmere-blue text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => { setEditing(false); setForm(attributes); setMsg(null) }}
          className="text-sm font-medium text-muted-foreground hover:text-tranmere-blue px-3 py-2"
        >
          Cancel
        </button>
        {msg && <p className="text-xs self-center text-red-600">{msg}</p>}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, highlighted }: { icon: React.ReactNode; label: string; value: string; highlighted?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlighted ? 'border-tranmere-blue/30 bg-tranmere-blue/5' : 'border-border bg-gray-50/40'}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className={`text-base font-bold mt-0.5 ${highlighted ? 'text-tranmere-blue' : ''}`}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  )
}
