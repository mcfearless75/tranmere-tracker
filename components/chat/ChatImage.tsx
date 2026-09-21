'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Thumbnail in the thread; tap opens a full-screen viewer (ported to body so chat overflow cannot clip it). */
export function ChatImage({ src, alt = 'Attachment' }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  function openViewer(e?: React.SyntheticEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    setOpen(true)
  }

  const overlay = open && mounted ? createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-white text-sm font-semibold px-3 py-2 rounded-lg bg-white/15"
        >
          Open original
        </a>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/15 p-2 text-white" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        className="flex-1 w-full object-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      />
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={openViewer}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        className="block w-full text-left mb-1"
        aria-label="Open image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="rounded-lg max-w-full max-h-60 object-contain bg-black/5" />
      </button>
      {overlay}
    </>
  )
}
