'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Paperclip, X, Bot } from 'lucide-react'
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

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'

export function ChatThread({ roomId, roomKind, currentUserId, initialMessages, members, canSend = true }: {
  roomId: string
  roomKind: string
  currentUserId: string
  initialMessages: Message[]
  members: Member[]
  canSend?: boolean
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [attachment, setAttachment] = useState<{ file: File; preview: string | null } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const memberById: Record<string, Member> = {}
  for (const m of members) memberById[m.user_id] = m
  const myName = memberById[currentUserId]?.users?.name ?? 'Someone'

  useEffect(() => {
    markRead(roomId)

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
          if ((payload.new as Message).sender_id !== currentUserId) {
            markRead(roomId)
            if ((payload.new as Message).sender_id === BOT_USER_ID) setAiTyping(false)
          }
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; name: string; typing: boolean }>()
        const typing = Object.values(state)
          .flat()
          .filter(p => p.typing && p.userId !== currentUserId)
          .map(p => p.name)
        setTypingUsers(typing)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId: currentUserId, name: myName, typing: false })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUserId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, aiTyping, typingUsers])

  function handleDraftChange(value: string) {
    setDraft(value)
    if (roomKind === 'bot' || !canSend) return
    channelRef.current?.track({ userId: currentUserId, name: myName, typing: true })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      channelRef.current?.track({ userId: currentUserId, name: myName, typing: false })
    }, 2000)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setAttachment({ file, preview })
    e.target.value = ''
  }

  async function uploadAttachment(file: File): Promise<{ url: string; kind: string } | null> {
    const ext = file.name.split('.').pop()
    const path = `${currentUserId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('chat-attachments').upload(path, file)
    if (error || !data) return null
    const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(data.path)
    return { url: publicUrl, kind: file.type.startsWith('image/') ? 'image' : 'file' }
  }

  async function send() {
    const body = draft.trim()
    if (!body && !attachment) return
    setSending(true)

    // Clear typing indicator
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    channelRef.current?.track({ userId: currentUserId, name: myName, typing: false })

    let attachmentUrl: string | null = null
    let attachmentKind: string | null = null
    if (attachment) {
      const result = await uploadAttachment(attachment.file)
      if (result) { attachmentUrl = result.url; attachmentKind = result.kind }
      setAttachment(null)
    }

    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({ room_id: roomId, sender_id: currentUserId, body: body || null, attachment_url: attachmentUrl, attachment_kind: attachmentKind })
      .select('*')
      .single()

    setSending(false)
    if (error) { alert(`Send failed: ${error.message}`); return }
    setDraft('')
    if (inserted) setMessages(prev => prev.find(p => p.id === inserted.id) ? prev : [...prev, inserted as Message])

    if (roomKind === 'bot' && body) {
      setAiTyping(true)
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId }),
        })
        if (!res.ok) setAiTyping(false)
      } catch {
        setAiTyping(false)
      }
    }
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 && roomKind === 'bot' && (
          <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center">
              <Bot size={30} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-lg">AI Coach</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">Ask me anything — training plans, nutrition, coursework help, or just how you&apos;re getting on.</p>
            </div>
          </div>
        )}
        {messages.length === 0 && roomKind !== 'bot' && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet{canSend ? ' — say hello 👋' : ''}</p>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === currentUserId
          const isBot = m.sender_id === BOT_USER_ID
          const prev = messages[i - 1]
          const showAvatar = !mine && (!prev || prev.sender_id !== m.sender_id)
          const sender = memberById[m.sender_id]?.users
          const initials = isBot ? 'AI' : (sender?.name ?? '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && (
                <div className={`w-7 h-7 rounded-full shrink-0 ${showAvatar ? '' : 'invisible'}`}>
                  {isBot ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 text-white">
                      <Bot size={14} />
                    </span>
                  ) : sender?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sender.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-white text-[10px] font-bold">
                      {initials}
                    </span>
                  )}
                </div>
              )}
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${mine ? 'bg-tranmere-blue text-white rounded-br-md' : 'bg-white border text-gray-900 rounded-bl-md'}`}>
                {!mine && showAvatar && (
                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                    {isBot ? 'AI Coach' : (sender?.name ?? '?')}
                  </p>
                )}
                {m.attachment_kind === 'image' && m.attachment_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.attachment_url} alt="attachment" className="rounded-lg max-w-full mb-1 max-h-60 object-cover" />
                )}
                {m.attachment_kind === 'file' && m.attachment_url && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer"
                    className={`underline text-xs flex items-center gap-1 mb-1 ${mine ? 'text-blue-200' : 'text-tranmere-blue'}`}>
                    📎 {decodeURIComponent(m.attachment_url.split('/').pop() ?? 'file')}
                  </a>
                )}
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}

        {/* AI typing dots */}
        {aiTyping && (
          <div className="flex items-end gap-1.5 justify-start">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 text-white shrink-0">
              <Bot size={14} />
            </span>
            <div className="bg-white border px-3 py-2.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Human typing indicator */}
        {typingUsers.length > 0 && !aiTyping && (
          <p className="text-xs text-muted-foreground px-1 animate-pulse">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
          </p>
        )}
      </div>

      {attachment && (
        <div className="bg-white border-t px-3 py-2 flex items-center gap-2 shrink-0">
          {attachment.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span className="text-sm text-muted-foreground truncate">📎 {attachment.file.name}</span>
          )}
          <button onClick={() => setAttachment(null)} className="ml-auto text-gray-400 hover:text-gray-600 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {canSend ? (
        <div className="bg-white border-t p-2 flex items-end gap-2 shrink-0 safe-bottom">
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-tranmere-blue shrink-0 active:scale-95 transition-transform" type="button" aria-label="Attach file">
            <Paperclip size={18} />
          </button>
          <textarea
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Message…"
            rows={1}
            className="flex-1 text-sm border rounded-2xl px-3 py-2 resize-none focus:ring-2 focus:ring-tranmere-blue outline-none max-h-32"
          />
          <button onClick={send} disabled={(!draft.trim() && !attachment) || sending}
            className="rounded-full bg-tranmere-blue text-white w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition-transform">
            <Send size={16} />
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 border-t p-3 text-center text-xs text-muted-foreground safe-bottom">
          This is a broadcast channel — only staff can post.
        </div>
      )}
    </>
  )
}
