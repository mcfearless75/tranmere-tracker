'use client'

import { useRef } from 'react'
import { Bot, SmilePlus } from 'lucide-react'
import { ChatImage } from '@/components/chat/ChatImage'
import { MessageBody } from '@/components/chat/MessageBody'
import type { ChatMessage } from '@/lib/chat/types'

export type ReactionChip = { emoji: string; count: number; mine: boolean }

export type MessageBubbleProps = {
  message: ChatMessage
  mine: boolean
  isBot: boolean
  showAvatar: boolean
  senderName: string
  avatarUrl: string | null
  chips: ReactionChip[]
  attachmentSrc: (url: string) => string | null
  onOpenSheet: (messageId: string) => void
  onToggleReaction: (messageId: string, emoji: string) => void
}

export function MessageBubble({
  message: m,
  mine,
  isBot,
  showAvatar,
  senderName,
  avatarUrl,
  chips,
  attachmentSrc,
  onOpenSheet,
  onToggleReaction,
}: MessageBubbleProps) {
  const holdTimer = useRef<number | null>(null)
  const holdStart = useRef<{ x: number; y: number } | null>(null)

  const initials = isBot ? 'AI' : senderName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  function openSheet(id: string) {
    onOpenSheet(id)
  }
  function startHold(id: string, x: number, y: number) {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdStart.current = { x, y }
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      openSheet(id)
    }, 380)
  }
  function moveHold(x: number, y: number) {
    const start = holdStart.current
    if (!start || !holdTimer.current) return
    const dx = x - start.x
    const dy = y - start.y
    if (dx * dx + dy * dy > 16 * 16) cancelHold()
  }
  function cancelHold() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
    holdStart.current = null
  }

  return (
    <div className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <div className={`w-7 h-7 rounded-full shrink-0 ${showAvatar ? '' : 'invisible'}`}>
          {isBot ? (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 text-white"><Bot size={14} /></span>
          ) : avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-white text-[10px] font-bold">{initials}</span>
          )}
        </div>
      )}
      {mine && (
      <button type="button" aria-label="React to message" onClick={() => openSheet(m.id)} className="mb-1 shrink-0 rounded-full p-1.5 text-tranmere-blue/70 active:bg-gray-100">
        <SmilePlus size={16} />
      </button>
      )}
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words select-none touch-manipulation ${mine ? 'bg-tranmere-blue text-white rounded-br-md' : 'bg-white border text-gray-900 rounded-bl-md'}`}
        onContextMenu={e => { e.preventDefault(); openSheet(m.id) }}
        onPointerDown={e => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          startHold(m.id, e.clientX, e.clientY)
        }}
        onPointerMove={e => moveHold(e.clientX, e.clientY)}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
      >
        {!mine && showAvatar && (
          <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{isBot ? 'AI Coach' : senderName}</p>
        )}
        {m.attachment_kind === 'image' && m.attachment_url && attachmentSrc(m.attachment_url) && (
          <ChatImage src={attachmentSrc(m.attachment_url)!} />
        )}
        {m.attachment_kind === 'file' && m.attachment_url && attachmentSrc(m.attachment_url) && (
          <a href={attachmentSrc(m.attachment_url)!} target="_blank" rel="noreferrer" className={`underline text-xs flex items-center gap-1 mb-1 ${mine ? 'text-blue-200' : 'text-tranmere-blue'}`}>
            {decodeURIComponent(m.attachment_url.split('/').pop()?.split('?')[0] ?? 'file')}
          </a>
        )}
        {m.body && <MessageBody body={m.body} mine={mine} />}
        <p className={`text-[10px] mt-0.5 ${mine ? 'text-blue-200' : 'text-gray-400'}`}>
          {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
        </p>
        {chips.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
            {chips.map(chip => (
              <button key={chip.emoji} type="button" onClick={() => onToggleReaction(m.id, chip.emoji)} className={`text-[11px] leading-none px-1.5 py-0.5 rounded-full border ${
                chip.mine ? (mine ? 'bg-white/20 border-white/40 text-white' : 'bg-blue-50 border-tranmere-blue/40') : (mine ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-50 border-gray-200')
              }`}>
                {chip.emoji}{chip.count > 1 ? ` ${chip.count}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
      {!mine && (
      <button type="button" aria-label="React to message" onClick={() => openSheet(m.id)} className="mb-1 shrink-0 rounded-full p-1.5 text-gray-400 active:bg-gray-100">
        <SmilePlus size={16} />
      </button>
      )}
    </div>
  )
}
