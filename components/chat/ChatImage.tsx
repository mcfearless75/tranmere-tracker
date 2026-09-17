'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/** Thumbnail in the thread; tap opens a full-screen viewer so staff can read a learner screenshot. */
export function ChatImage({ src, alt = 'Attachment' }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false)

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerDown={e => e.stopPropagation()}
        className="block w-full text-left mb-1"
        aria-label="Open image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="rounded-lg max-w-full max-h-60 object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/92 flex items-center justify-center p-3"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 rounded-full bg-white/15 p-2 text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[92dvh] object-contain rounded-lg"
          />
        </div>
      )}
    </>
  )
}
