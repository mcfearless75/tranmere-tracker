'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { deleteFolder, renameFolder } from '../actions'

export function FolderHeader({ folderId, folderName }: { folderId: string; folderName: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(folderName)
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    start(async () => {
      try {
        const res = await renameFolder(folderId, value)
        if (res.ok) {
          setEditing(false)
          router.refresh()
        } else setError(res.error ?? 'Could not rename')
      } catch {
        // A Server Action rejects, rather than returning an error, when the
        // request itself fails — offline, 5xx, a deploy landing mid-call.
        // Stays in edit mode so the typed name is not lost.
        setError('Could not rename — you may be offline. Try again.')
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete "${folderName}" and everything inside it? This cannot be undone.`)) return
    setError(null)
    start(async () => {
      try {
        const res = await deleteFolder(folderId)
        if (res.ok) router.push(res.parentId ? `/documents/${res.parentId}` : '/documents')
        else setError(res.error ?? 'Failed to delete')
      } catch {
        setError('Could not delete — you may be offline. Try again.')
      }
    })
  }

  return (
    <div className="ml-auto flex items-center gap-1 shrink-0">
      {editing ? (
        <>
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            maxLength={60}
            className="w-36 sm:w-48 px-2 py-1.5 border rounded-lg text-sm"
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button type="button" onClick={save} disabled={pending} className="p-2 rounded-lg text-tranmere-blue" aria-label="Save name">
            <Check size={16} />
          </button>
          <button type="button" onClick={() => { setEditing(false); setValue(folderName) }} className="p-2 rounded-lg text-gray-400" aria-label="Cancel">
            <X size={16} />
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="p-2 rounded-lg text-gray-400 hover:text-tranmere-blue" aria-label="Rename folder">
          <Pencil size={16} />
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={pending} aria-label={`Delete folder ${folderName}`} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
        <Trash2 size={18} />
      </button>
      {error && <span className="text-xs text-red-600 max-w-[8rem]">{error}</span>}
    </div>
  )
}
