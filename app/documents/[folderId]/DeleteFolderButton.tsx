'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteFolder } from '../actions'

export function DeleteFolderButton({ folderId, folderName }: { folderId: string; folderName: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm(`Delete "${folderName}" and all its files? This cannot be undone.`)) return
    setError(null)
    start(async () => {
      const res = await deleteFolder(folderId)
      if (res.ok) router.push('/documents')
      else setError(res.error ?? 'Failed to delete')
    })
  }

  return (
    <div className="ml-auto flex items-center gap-2 shrink-0">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={handleDelete}
        disabled={pending}
        aria-label={`Delete folder ${folderName}`}
        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 size={18} />
      </button>
    </div>
  )
}
