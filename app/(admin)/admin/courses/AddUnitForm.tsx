'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AddUnitForm({ courseId }: { courseId: string }) {
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleAdd() {
    if (!number.trim() || !name.trim()) return
    setSaving(true)
    await supabase.from('btec_units').insert({
      course_id: courseId,
      unit_number: number.trim(),
      unit_name: name.trim(),
    })
    setNumber('')
    setName('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2 mt-2">
      <Input
        placeholder="Unit no."
        value={number}
        onChange={e => setNumber(e.target.value)}
        className="w-24 text-sm"
      />
      <Input
        placeholder="Unit name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 text-sm"
      />
      <Button
        onClick={handleAdd}
        disabled={saving || !number.trim() || !name.trim()}
        size="sm"
        className="bg-tranmere-blue text-white shrink-0"
      >
        {saving ? '…' : 'Add'}
      </Button>
    </div>
  )
}
