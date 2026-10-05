'use client'

import { useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { RotateCw, X, Check } from 'lucide-react'
import { cropImage } from '@/lib/chat/cropImage'

type AspectKey = 'original' | 'square' | 'portrait' | 'wide'
const ASPECTS: { key: AspectKey; label: string; value: number | null }[] = [
  { key: 'original', label: 'Original', value: null },
  { key: 'square', label: '1:1', value: 1 },
  { key: 'portrait', label: '4:5', value: 4 / 5 },
  { key: 'wide', label: '16:9', value: 16 / 9 },
]

/**
 * Full-screen crop / rotate / zoom before a chat image is sent.
 * Cancel keeps the photo exactly as picked; Done swaps in the edited JPEG.
 */
export function ImageEditSheet({
  file,
  src,
  onDone,
  onCancel,
}: {
  file: File
  src: string
  onDone: (edited: File) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspectKey, setAspectKey] = useState<AspectKey>('original')
  const [natural, setNatural] = useState<number | null>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Original aspect follows rotation: a portrait photo turned 90° is landscape.
  const originalAspect = natural ? (rotation % 180 === 0 ? natural : 1 / natural) : 4 / 3
  const aspect = ASPECTS.find(a => a.key === aspectKey)?.value ?? originalAspect

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function done() {
    if (!area) return
    setSaving(true)
    setError(null)
    try {
      onDone(await cropImage(src, area, rotation, file.name))
    } catch {
      // HEIC on some desktop browsers, or a canvas out of memory — the
      // original is still attached, so they can just send it as is.
      setError("Couldn't edit this photo — tap Cancel to send it as is.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-label="Edit photo">
      {/* Title only up here. On iPhone the top of the screen can sit under
          the status bar / Dynamic Island, where taps don't land — so the
          Cancel and Done controls live in the bottom bar instead. */}
      <div className="px-3 pt-3 pb-2 text-center text-white safe-top">
        <span className="text-sm font-semibold">Edit photo</span>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={(_, px) => setArea(px)}
          onMediaLoaded={m => setNatural(m.naturalWidth / m.naturalHeight)}
        />
      </div>

      {error && <p className="text-center text-xs text-red-300 px-4 py-1">{error}</p>}

      <div className="px-4 pt-3 pb-4 space-y-3 text-white safe-bottom">
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={4} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))} aria-label="Zoom" className="flex-1 accent-sky-400" />
          <button type="button" onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Rotate"
            className="p-2 rounded-full bg-white/10"><RotateCw size={18} /></button>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          {ASPECTS.map(a => (
            <button key={a.key} type="button" onClick={() => setAspectKey(a.key)}
              className={`px-3 py-1 rounded-full text-xs border ${aspectKey === a.key ? 'bg-white text-black border-white' : 'border-white/40'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancel} aria-label="Cancel editing"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-sm font-semibold">
            <X size={18} /> Cancel
          </button>
          <button type="button" onClick={done} disabled={!area || saving} aria-label="Done editing"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-50">
            <Check size={18} /> {saving ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
