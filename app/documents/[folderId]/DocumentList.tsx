'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Trash2, Download } from 'lucide-react'
import { deleteDocument } from '../actions'

type Doc = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  url: string | null
}

function iconFor(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText
  if (mimeType.includes('word')) return FileText
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return FileSpreadsheet
  if (mimeType.startsWith('image/')) return FileImage
  return FileIcon
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentList({ documents, isStaff }: { documents: Doc[]; isStaff: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(null)
    setRemovingId(id)
    start(async () => {
      const res = await deleteDocument(id)
      setRemovingId(null)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Failed to delete')
    })
  }

  if (documents.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">No files in this folder yet.</p>
  }

  return (
    <div className="rounded-2xl border bg-white divide-y">
      {error && <p className="text-xs text-red-600 px-3 py-2">{error}</p>}
      {documents.map(doc => {
        const Icon = iconFor(doc.mime_type)
        return (
          <div key={doc.id} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-lg bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue shrink-0">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(doc.size_bytes)}</p>
            </div>
            {doc.url && (
              <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Download ${doc.name}`}
                className="p-2 rounded-lg text-tranmere-blue hover:bg-tranmere-blue/10 shrink-0">
                <Download size={16} />
              </a>
            )}
            {isStaff && (
              <button
                onClick={() => handleDelete(doc.id, doc.name)}
                disabled={pending && removingId === doc.id}
                aria-label={`Delete ${doc.name}`}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
