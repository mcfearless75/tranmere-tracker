'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

export function GpsImportForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setResult(null)
    const form = new FormData()
    form.append('file', file)
    form.append('session_label', label || 'Training')
    try {
      const res = await fetch('/api/admin/gps-import', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) {
        setResult({ ok: false, message: data.error })
      } else {
        setResult({ ok: true, message: data.message })
        setFile(null)
        setLabel('')
        router.refresh()
      }
    } catch {
      // fetch REJECTS on a network failure rather than returning a response,
      // so without the finally this stayed stuck on "Uploading…" until a
      // reload — and GPS imports are done pitchside on patchy signal.
      setResult({ ok: false, message: 'Could not reach the server — you may be offline. Try again.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-xl">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Session label fallback (optional)</label>
        <Input
          placeholder="Only used if the CSV has no session title"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={60}
          className="mt-1"
        />
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-tranmere-blue hover:bg-blue-50 transition-colors"
      >
        <Upload className="mx-auto mb-2 text-gray-400" size={32} />
        {file ? (
          <p className="text-sm font-medium text-tranmere-blue">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drop Catapult or STATSports CSV here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {result && (
        <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
          result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
        }`}>
          {result.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          {result.message}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-tranmere-blue text-white"
      >
        {uploading ? 'Importing…' : 'Import GPS Data'}
      </Button>
    </div>
  )
}
