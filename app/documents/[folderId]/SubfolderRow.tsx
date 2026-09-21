'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Folder, Pencil, Check, X } from 'lucide-react'
import { moveDocument, renameFolder } from '../actions'

export function SubfolderRow({ id, name, isStaff }: { id: string; name: string; isStaff: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [pending, start] = useTransition()
  const [over, setOver] = useState(false)

  function save() {
    start(async () => {
      const res = await renameFolder(id, value)
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setOver(false)
    const docId = e.dataTransfer.getData('application/x-tranmere-doc') || e.dataTransfer.getData('text/plain')
    if (!docId || !isStaff) return
    start(async () => {
      const res = await moveDocument(docId, id)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 ${over ? 'bg-tranmere-blue/10 ring-2 ring-tranmere-blue/30' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <Link href={`/documents/${id}`} className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-full bg-tranmere-blue/10 text-tranmere-blue flex items-center justify-center shrink-0">
          <Folder size={18} />
        </div>
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onClick={e => e.preventDefault()}
            className="flex-1 min-w-0 px-2 py-1 border rounded-lg text-sm"
            onKeyDown={e => { if (e.key === 'Enter') save() }}
          />
        ) : (
          <p className="font-medium text-sm break-words">{name}</p>
        )}
      </Link>
      {isStaff && (editing ? (
        <>
          <button type="button" onClick={save} disabled={pending} className="p-2 text-tranmere-blue" aria-label="Save folder name"><Check size={16} /></button>
          <button type="button" onClick={() => { setEditing(false); setValue(name) }} className="p-2 text-gray-400" aria-label="Cancel"><X size={16} /></button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="p-2 text-gray-400" aria-label="Rename folder"><Pencil size={16} /></button>
      ))}
    </div>
  )
}
