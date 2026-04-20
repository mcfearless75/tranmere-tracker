'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'
import { markRead } from '../actions'

type Message = {
  id: string
  sender_id: string
  body: string | null
  attachment_url: string | null
  attachment_kind: string | null
  created_at: string
}
type Member = { user_id: string; users: { id: string; name: string | null; avatar_url: string | null } | null }

export function ChatThread({ roomId, currentUserId, initialMessages, members }: {
  roomId: string
  currentUserId: string
  initialMessages: Message[]
  members: Member[]
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const memberById: Record<string, Member> = {}
  for (const m of members) memberById[m.user_id] = m

  useEffect(() => {
    // Mark room read on open
    markRead(roomId)

    // Subscribe to Realtime INSERTs on this room
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        payload => {
          setMessages(prev => {
            const m = payload.new as Message
            if (prev.find(p => p.id === m.id)) return prev
            return [...prev, m]
          })
          // Mark read if the new message isn't from us
          if ((payload.new as Message).sender_id !== currentUserId) markRead(roomId)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, supabase, currentUserId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function send() {
    const body = draft.trim()
    if (!body) return
    setSending(true)
    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({ room_id: roomId, sender_id: currentUserId, body })
      .select('*')
      .single()
    setSending(false)
    if (error) {
      alert(`Send failed: ${error.message}`)
      return
    }
    setDraft('')
    if (inserted) setMessages(prev => prev.find(p => p.id === inserted.id) ? prev : [...prev, inserted as Message])
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet — say hello 👋</p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === currentUserId
          const prev = messages[i - 1]
          const showAvatar = !mine && (!prev || prev.sender_id !== m.sender_id)
          const sender = memberById[m.sender_id]?.users
          const initials = (sender?.name ?? '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && (
                <div className={`w-7 h-7 rounded-full shrink-0 ${showAvatar ? '' : 'invisible'}`}>
                  {sender?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sender.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-white text-[10px] font-bold">
                      {initials}
                    </span>
                  )}
                </div>
              )}
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${
                  mine
                    ? 'bg-tranmere-blue text-white rounded-br-md'
                    : 'bg-white border text-gray-900 rounded-bl-md'
                }`}
              >
                {!mine && showAvatar && (
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{sender?.name ?? '?'}</p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white border-t p-2 flex items-end gap-2 shrink-0 safe-bottom">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Message…"
          rows={1}
          className="flex-1 text-sm border rounded-2xl px-3 py-2 resize-none focus:ring-2 focus:ring-tranmere-blue outline-none max-h-32"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="rounded-full bg-tranmere-blue text-white w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95"
        >
          <Send size={16} />
        </button>
      </div>
    </>
  )
}
