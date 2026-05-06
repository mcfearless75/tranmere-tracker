'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
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
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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
        <span className="text-[11px] text-tranmere-blue font-medium px-1 whitespace-nowrap">{feedback}</span>
      ) : (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
          disabled={pending}
          aria-label="Chat options"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-tranmere-blue hover:bg-tranmere-blue/10 transition-colors disabled:opacity-40"
        >
          <MoreVertical size={16} />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-xl border bg-white shadow-lg py-1 text-sm">
          <button
            onClick={handleNudge}
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
          >
            <Bell size={14} className="text-tranmere-blue" />
            Nudge
          </button>
          <button
            onClick={handleLeave}
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-red-600"
          >
            {isOwner && isDmOrBot ? <Trash2 size={14} /> : <LogOut size={14} />}
            {isOwner && isDmOrBot ? 'Delete' : 'Leave'}
          </button>
        </div>
      )}
    </div>
  )
}
