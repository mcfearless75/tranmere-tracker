'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { recordDocument } from './actions'

// Mirrors the allowed_mime_types/file_size_limit on the 'documents' bucket
// (supabase/migrations/045_documents.sql) — client-side check is UX only,
// the bucket's own RLS + limits are the actual enforcement.
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
])
const MAX_SIZE_BYTES = 20 * 1024 * 1024

type UploadState = { file: File; status: 'uploading' | 'error'; error?: string }

export function UploadDropzone({ folderId }: { folderId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function validate(file: File): string | null {
    if (!ALLOWED_TYPES.has(file.type)) return 'File type not allowed'
    if (file.size > MAX_SIZE_BYTES) return 'File is larger than 20MB'
    return null
  }

  async function uploadOne(file: File) {
    const validationError = validate(file)
    if (validationError) {
      setUploads(prev => [...prev, { file, status: 'error', error: validationError }])
      return
    }
    setUploads(prev => [...prev, { file, status: 'uploading' }])

    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folderId}/${crypto.randomUUID()}-${sanitized}`

    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) {
      setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'error', error: uploadError.message } : u))
      return
    }

    const res = await recordDocument(folderId, path, file.name, file.type, file.size)
    if (!res.ok) {
      setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'error', error: res.error ?? 'Failed to save' } : u))
      return
    }

    setUploads(prev => prev.filter(u => u.file !== file))
    router.refresh()
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(uploadOne)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId])

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-tranmere-blue bg-tranmere-blue/5' : 'border-gray-300 hover:border-tranmere-blue/50'
        }`}
      >
        <UploadCloud size={24} className="text-tranmere-blue" />
        <p className="text-sm font-medium">Drag files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, JPG, PNG — up to 20MB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          aria-label="Upload files"
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-2 text-xs rounded-lg border px-3 py-2">
              <span className="flex-1 truncate">{u.file.name}</span>
              {u.status === 'uploading' && <span className="text-muted-foreground">Uploading…</span>}
              {u.status === 'error' && <span className="text-red-600">{u.error}</span>}
              <button onClick={() => setUploads(prev => prev.filter((_, j) => j !== i))} aria-label="Dismiss" className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
