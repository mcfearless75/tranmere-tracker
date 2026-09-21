'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const SUGGEST: Record<string, string> = {
  lowther: 'Tranmere P16',
  garrett: 'Tranmere P17',
  chester: 'Tranmere P18',
  kennedy: 'Tranmere P19',
  piercy: 'Tranmere P20',
  barton: 'Tranmere P21',
  mcintosh: 'Tranmere P22',
  duncan: 'Tranmere P23',
  macaulay: 'Tranmere P24',
  carey: 'Tranmere P25',
  teudde: 'Tranmere P26',
  edwards: 'Tranmere P28',
  bullock: 'Tranmere P29',
  bohe: 'Tranmere P30',
}

function suggestFor(name: string, current: string | null) {
  if (current) return current
  if (/caleb\s+mcwilliam/i.test(name)) return 'Tranmere P27'
  const last = name.trim().split(/\s+/).pop()?.toLowerCase() ?? ''
  return SUGGEST[last] ?? ''
}

export function CatapultCodeRoster({
  students,
}: {
  students: { id: string; name: string; catapult_code: string | null }[]
}) {
  const router = useRouter()
  const initial = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of students) m[s.id] = suggestFor(s.name, s.catapult_code)
    return m
  }, [students])
  const [codes, setCodes] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setMsg(null)
    const updates = students.map(s => ({ id: s.id, code: codes[s.id] ?? '' }))
    const res = await fetch('/api/admin/catapult-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) setMsg(data.error ?? 'Save failed')
    else {
      setMsg(`Saved ${data.saved} player code(s).`)
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold">Catapult codes on each player</p>
        <p className="text-xs text-muted-foreground">Must match the CSV Player Name (Tranmere P16). Suggested from the Oldham clipboard.</p>
      </div>
      <div className="divide-y max-h-[28rem] overflow-y-auto">
        {students.map(s => (
          <label key={s.id} className="flex items-center gap-3 px-4 py-2">
            <span className="flex-1 text-sm font-medium min-w-0 truncate">{s.name}</span>
            <input
              value={codes[s.id] ?? ''}
              onChange={e => setCodes(prev => ({ ...prev, [s.id]: e.target.value }))}
              placeholder="Tranmere Pxx"
              className="w-40 shrink-0 border rounded-lg px-2 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>
      <div className="p-3 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={busy} className="bg-tranmere-blue text-white">
          {busy ? 'Saving…' : 'Save codes'}
        </Button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  )
}
