'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Bell, Trash2, LogOut } from 'lucide-react'
import { nudgeRoom, leaveOrDeleteRoom } from './actions'

export function ChatRoomActions({
  roomId,
  isOwner,
  isDmOrBot,
}: {
  roomId: string
  isOwner: boolean
  isDmOrBot: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.right - 180 })
    }
    setOpen(v => !v)
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleNudge(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    start(async () => {
      const res = await nudgeRoom(roomId)
      setFeedback(res.ok ? 'Nudge sent ✓' : (res.error ?? 'Failed'))
      setTimeout(() => setFeedback(null), 2500)
    })
  }

  function handleLeave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    const label = isOwner && isDmOrBot ? 'Delete this conversation?' : 'Leave this conversation?'
    if (!confirm(label)) return
    start(async () => {
      const res = await leaveOrDeleteRoom(roomId)
      if (res.ok) router.refresh()
      else {
        setFeedback(res.error ?? 'Failed')
        setTimeout(() => setFeedback(null), 2500)
      }
    })
  }

  return (
    <div ref={menuRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
      {feedback ? (
        <span className="text-[11px] text-tranmere-blue font-medium px-2 whitespace-nowrap">{feedback}</span>
      ) : (
        <button
          ref={btnRef}
          onClick={openMenu}
          disabled={pending}
          aria-label="Chat options"
          className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-tranmere-blue hover:bg-tranmere-blue/10 active:bg-tranmere-blue/20 transition-colors disabled:opacity-40"
        >
          <MoreVertical size={20} />
        </button>
      )}

      {open && dropPos && (
        <div className="fixed z-[200] min-w-[180px] rounded-xl border bg-white shadow-xl py-1.5 text-sm"
          style={{ top: dropPos.top, left: Math.max(8, dropPos.left) }}
        >
          <button
            onClick={handleNudge}
            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left font-medium"
          >
            <Bell size={15} className="text-tranmere-blue" />
            Nudge
          </button>
          <div className="border-t my-1" />
          <button
            onClick={handleLeave}
            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-left font-medium text-red-600"
          >
            {isOwner && isDmOrBot ? <Trash2 size={15} /> : <LogOut size={15} />}
            {isOwner && isDmOrBot ? 'Delete conversation' : 'Leave conversation'}
          </button>
        </div>
      )}
    </div>
  )
}
