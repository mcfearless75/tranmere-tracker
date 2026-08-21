'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, X } from 'lucide-react'
import { createFolder } from './actions'

export function CreateFolderButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!name.trim()) { setError('Give the folder a name'); return }
    setSubmitting(true)
    const res = await createFolder(name.trim())
    setSubmitting(false)
    if (typeof res === 'string') {
      setName('')
      setOpen(false)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-tranmere-blue text-tranmere-blue px-4 py-2.5 text-sm font-semibold hover:bg-tranmere-blue/5"
      >
        <FolderPlus size={14} /> New folder
      </button>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Folder name (e.g. Bursary Information)"
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
          <X size={14} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-tranmere-blue to-blue-700 text-white px-4 py-2.5 text-sm font-semibold shadow disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create folder'}
      </button>
    </div>
  )
}
