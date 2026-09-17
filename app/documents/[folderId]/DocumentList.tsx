'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, FileSpreadsheet, FileImage, File as FileIcon, Trash2, Download, Eye } from 'lucide-react'
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
  const [openId, setOpenId] = useState<string | null>(null)

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(null)
    setRemovingId(id)
    start(async () => {
      const res = await deleteDocument(id)
      setRemovingId(null)
      if (res.ok) {
        setOpenId(null)
        router.refresh()
      } else setError(res.error ?? 'Failed to delete')
    })
  }

  if (documents.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">No files in this folder yet.</p>
  }

  return (
    <div className="rounded-2xl border bg-white divide-y overflow-hidden">
      {error && <p className="text-xs text-red-600 px-3 py-2">{error}</p>}
      <p className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground sm:hidden">Swipe a file left for View / Download / Delete</p>
      {documents.map(doc => {
        const Icon = iconFor(doc.mime_type)
        const open = openId === doc.id
        return (
          <SwipeRow key={doc.id} open={open} onOpen={() => setOpenId(doc.id)} onClose={() => setOpenId(null)}>
            <div className="flex items-start gap-3 bg-white p-3">
              <div className="w-10 h-10 rounded-lg bg-tranmere-blue/10 flex items-center justify-center text-tranmere-blue shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(doc.size_bytes)}</p>
              </div>
            </div>
            <div className="flex h-full items-stretch">
              {doc.url && (
                <>
                  <a href={doc.url} target="_blank" rel="noreferrer" className="flex w-16 flex-col items-center justify-center gap-0.5 bg-tranmere-blue text-white text-[10px] font-semibold">
                    <Eye size={16} /> View
                  </a>
                  <a href={doc.url} download={doc.name} className="flex w-16 flex-col items-center justify-center gap-0.5 bg-gray-700 text-white text-[10px] font-semibold">
                    <Download size={16} /> Save
                  </a>
                </>
              )}
              {isStaff && (
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id, doc.name)}
                  disabled={pending && removingId === doc.id}
                  className="flex w-16 flex-col items-center justify-center gap-0.5 bg-red-600 text-white text-[10px] font-semibold disabled:opacity-50"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </SwipeRow>
        )
      })}
    </div>
  )
}

function SwipeRow({
  open,
  onOpen,
  onClose,
  children,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  children: [React.ReactNode, React.ReactNode]
}) {
  const startX = useRef(0)
  const startY = useRef(0)
  const locked = useRef<'h' | 'v' | null>(null)
  const [dx, setDx] = useState(0)
  const actions = children[1]
  const body = children[0]
  const reveal = 176

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    startY.current = e.clientY
    locked.current = null
  }
  function onPointerMove(e: React.PointerEvent) {
    const x = e.clientX - startX.current
    const y = e.clientY - startY.current
    if (!locked.current) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return
      locked.current = Math.abs(x) > Math.abs(y) ? 'h' : 'v'
    }
    if (locked.current !== 'h') return
    e.preventDefault()
    const next = open ? -reveal + x : x
    setDx(Math.max(-reveal - 24, Math.min(24, next)))
  }
  function onPointerUp() {
    if (locked.current === 'h') {
      const final = open ? -reveal + dx : dx
      if (final < -56) onOpen()
      else onClose()
    }
    setDx(0)
    locked.current = null
  }

  const shift = open ? -reveal + (dx || 0) : dx

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex">{actions}</div>
      <div
        className="relative bg-white touch-pan-y"
        style={{ transform: `translateX(${shift}px)`, transition: locked.current === 'h' ? 'none' : 'transform 180ms ease' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {body}
      </div>
    </div>
  )
}
