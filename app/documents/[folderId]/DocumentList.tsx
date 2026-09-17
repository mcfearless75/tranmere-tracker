'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Trash2, Download, Eye, Pencil, Check, X } from 'lucide-react'
import { deleteDocument, renameDocument } from '../actions'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
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

  function saveName(id: string) {
    setError(null)
    start(async () => {
      const res = await renameDocument(id, editValue)
      if (res.ok) {
        setEditingId(null)
        router.refresh()
      } else setError(res.error ?? 'Could not rename')
    })
  }

  if (documents.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">No files in this folder yet.</p>
  }

  return (
    <div className="rounded-2xl border bg-white divide-y overflow-hidden">
      {error && <p className="text-xs text-red-600 px-3 py-2">{error}</p>}
      {documents.map(doc => {
        const Icon = iconFor(doc.mime_type)
        const editing = editingId === doc.id
        return (
          <div key={doc.id} className="p-3 space-y-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-lg text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') saveName(doc.id); if (e.key === 'Escape') setEditingId(null) }}
                  />
                ) : (
                  <p className="text-sm font-medium break-words">{doc.name}</p>
                )}
                <p className="text-xs text-muted-foreground">{formatSize(doc.size_bytes)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {doc.url && (
                <>
                  <a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-tranmere-blue/20 bg-tranmere-blue/5 px-3 py-2 text-xs font-semibold text-tranmere-blue">
                    <Eye size={14} /> View
                  </a>
                  <a href={doc.url} download={doc.name} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                    <Download size={14} /> Download
                  </a>
                </>
              )}
              {isStaff && (editing ? (
                <>
                  <button type="button" onClick={() => saveName(doc.id)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-tranmere-blue/20 px-3 py-2 text-xs font-semibold text-tranmere-blue">
                    <Check size={14} /> Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-gray-600">
                    <X size={14} /> Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { setEditingId(doc.id); setEditValue(doc.name) }} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                  <Pencil size={14} /> Rename
                </button>
              ))}
              {isStaff && (
                <button type="button" onClick={() => handleDelete(doc.id, doc.name)} disabled={pending && removingId === doc.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
