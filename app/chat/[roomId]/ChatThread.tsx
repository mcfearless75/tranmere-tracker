'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Send, Paperclip, X, Bot } from 'lucide-react'
import { MessageReactionSheet } from '@/components/chat/MessageReactionSheet'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ReplyQuote } from '@/components/chat/ReplyQuote'
import { markRead, notifyRoomMembers } from '../actions'
import type { ChatMessage, ReplyParent } from '@/lib/chat/types'

type Member = { user_id: string; users: { id: string; name: string | null; avatar_url: string | null } | null }
export type ChatReaction = { id: string; message_id: string; user_id: string; emoji: string }

const BOT_USER_ID = '00000000-0000-0000-0000-000000000099'
const AI_REPLY_TIMEOUT_MS = 20_000

export async function fetchBotReplyAfter(
  supabase: SupabaseClient,
  roomId: string,
  sentAt: string,
): Promise<ChatMessage | null> {
  try {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .eq('sender_id', BOT_USER_ID)
      .gt('created_at', sentAt)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return (data as ChatMessage | null) ?? null
  } catch {
    return null
  }
}

export function ChatThread({ roomId, roomKind, currentUserId, initialMessages, members, canSend = true, initialReactions = [], initialReplyParents = [] }: {
  roomId: string
  roomKind: string
  currentUserId: string
  initialMessages: ChatMessage[]
  members: Member[]
  canSend?: boolean
  initialReactions?: ChatReaction[]
  initialReplyParents?: ReplyParent[]
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [aiTyping, setAiTyping] = useState(false)
  const [aiTimedOut, setAiTimedOut] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [attachment, setAttachment] = useState<{ file: File; preview: string | null } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [reactions, setReactions] = useState<ChatReaction[]>(initialReactions)
  const [reactingTo, setReactingTo] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [replyParents, setReplyParents] = useState<Record<string, ReplyParent>>(
    Object.fromEntries(initialReplyParents.map(p => [p.id, p]))
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiReplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ids we've already tried to fetch a reply parent for, whether or not the
  // fetch found a row. Without this, an id the query can never resolve (RLS
  // denies it, or it was hard-deleted) would be recomputed as still-missing
  // on every render, refire the fetch, and loop forever.
  const attemptedParentIds = useRef<Set<string>>(new Set())

  const memberById: Record<string, Member> = {}
  for (const m of members) memberById[m.user_id] = m
  const myName = memberById[currentUserId]?.users?.name ?? 'Someone'

  useEffect(() => {
    markRead(roomId)
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, payload => {
        setMessages(prev => {
          const m = payload.new as ChatMessage
          if (prev.find(p => p.id === m.id)) return prev
          return [...prev, m]
        })
        if ((payload.new as ChatMessage).sender_id !== currentUserId) {
          markRead(roomId)
          if ((payload.new as ChatMessage).sender_id === BOT_USER_ID) {
            setAiTyping(false)
            setAiTimedOut(false)
            if (aiReplyTimeoutRef.current) {
              clearTimeout(aiReplyTimeoutRef.current)
              aiReplyTimeoutRef.current = null
            }
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, payload => {
        const updated = payload.new as ChatMessage & { deleted_at: string | null }
        if (updated.deleted_at) setMessages(prev => prev.filter(m => m.id !== updated.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_message_reactions' }, payload => {
        const row = payload.new as ChatReaction
        setReactions(prev => (prev.find(r => r.id === row.id) ? prev : [...prev, row]))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_message_reactions' }, payload => {
        const row = payload.old as { id?: string }
        if (row.id) setReactions(prev => prev.filter(r => r.id !== row.id))
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; name: string; typing: boolean }>()
        setTypingUsers(Object.values(state).flat().filter(p => p.typing && p.userId !== currentUserId).map(p => p.name))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await channel.track({ userId: currentUserId, name: myName, typing: false })
      })
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      if (aiReplyTimeoutRef.current) clearTimeout(aiReplyTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUserId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, aiTyping, typingUsers])

  useEffect(() => {
    const paths = messages.map(m => m.attachment_url).filter((u): u is string => !!u && !u.startsWith('http') && !signedUrls[u])
    if (paths.length === 0) return
    let cancelled = false
    Promise.all(paths.map(async p => {
      const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(p, 3600)
      return [p, data?.signedUrl ?? ''] as const
    })).then(entries => {
      if (cancelled) return
      setSignedUrls(prev => {
        const next = { ...prev }
        for (const [p, u] of entries) if (u) next[p] = u
        return next
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  function attachmentSrc(url: string): string | null {
    return url.startsWith('http') ? url : signedUrls[url] ?? null
  }

  function parentFor(message: ChatMessage): ReplyParent | null {
    if (!message.reply_to_id) return null
    const inWindow = messages.find(m => m.id === message.reply_to_id)
    if (inWindow) {
      return {
        id: inWindow.id,
        sender_id: inWindow.sender_id,
        body: inWindow.body,
        attachment_kind: inWindow.attachment_kind,
        deleted_at: null,
      }
    }
    return replyParents[message.reply_to_id] ?? null
  }

  // A reply can point at a message that is neither in the loaded window nor
  // in initialReplyParents — e.g. one that arrives over realtime after page
  // load, replying to something older. Fetch those lazily so the quote
  // doesn't render blank.
  useEffect(() => {
    const missing = messages
      .map(m => m.reply_to_id)
      .filter((id): id is string =>
        !!id && !messages.some(m => m.id === id) && !replyParents[id] && !attemptedParentIds.current.has(id))
    if (missing.length === 0) return
    // Mark these attempted before the request fires (a ref, so this doesn't
    // retrigger the effect) so an id the query never resolves is not retried.
    for (const id of missing) attemptedParentIds.current.add(id)
    let cancelled = false
    supabase
      .from('chat_messages')
      .select('id, sender_id, body, attachment_kind, deleted_at')
      .in('id', missing)
      .then(({ data }: { data: ReplyParent[] | null }) => {
        if (cancelled || !data || data.length === 0) return
        setReplyParents(prev => ({
          ...prev,
          ...Object.fromEntries(data.map(p => [p.id, p])),
        }))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, replyParents, supabase])

  function jumpToMessage(messageId: string) {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-tranmere-blue')
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-tranmere-blue'), 1200)
  }

  async function deleteMessage(id: string) {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    setDeletingId(id)
    const { error } = await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setDeletingId(null)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)
    if (existing) {
      setReactions(prev => prev.filter(r => r.id !== existing.id))
      const { error } = await supabase.from('chat_message_reactions').delete().eq('id', existing.id)
      if (error) {
        setReactions(prev => [...prev, existing])
        alert(`Could not remove reaction: ${error.message}`)
      }
      return
    }
    const { data, error } = await supabase.from('chat_message_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji }).select('id, message_id, user_id, emoji').single()
    if (error) {
      if (!String(error.message).toLowerCase().includes('duplicate')) alert(`Could not react: ${error.message}`)
      return
    }
    if (data) setReactions(prev => (prev.find(r => r.id === data.id) ? prev : [...prev, data as ChatReaction]))
  }

  function reactionsFor(messageId: string) {
    const grouped: Record<string, { emoji: string; count: number; mine: boolean }> = {}
    for (const r of reactions) {
      if (r.message_id !== messageId) continue
      const entry = grouped[r.emoji] ??= { emoji: r.emoji, count: 0, mine: false }
      entry.count += 1
      if (r.user_id === currentUserId) entry.mine = true
    }
    return Object.values(grouped)
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    if (roomKind === 'bot' || !canSend) return
    channelRef.current?.track({ userId: currentUserId, name: myName, typing: true })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      channelRef.current?.track({ userId: currentUserId, name: myName, typing: false })
    }, 2000)
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

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
    return { url: data.path, kind: file.type.startsWith('image/') ? 'image' : 'file' }
  }

  async function send() {
    const body = draft.trim()
    if (!body && !attachment) return
    setSending(true)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    channelRef.current?.track({ userId: currentUserId, name: myName, typing: false })
    let attachmentUrl: string | null = null
    let attachmentKind: string | null = null
    if (attachment) {
      const result = await uploadAttachment(attachment.file)
      if (result) { attachmentUrl = result.url; attachmentKind = result.kind }
      setAttachment(null)
    }
    const { data: inserted, error } = await supabase.from('chat_messages').insert({ room_id: roomId, sender_id: currentUserId, body: body || null, attachment_url: attachmentUrl, attachment_kind: attachmentKind, reply_to_id: replyingTo?.id ?? null }).select('*').single()
    setSending(false)
    if (error) { alert(`Send failed: ${error.message}`); return }
    setDraft('')
    setReplyingTo(null)
    if (inserted) setMessages(prev => prev.find(p => p.id === inserted.id) ? prev : [...prev, inserted as ChatMessage])
    if (roomKind !== 'bot') notifyRoomMembers(
      roomId,
      myName ?? 'Someone',
      body || 'Attachment',
      replyingTo && replyingTo.sender_id !== currentUserId ? replyingTo.sender_id : undefined,
    ).catch(() => {})
    if (roomKind === 'bot' && body) {
      const sentAt = new Date().toISOString()
      setAiTyping(true)
      setAiTimedOut(false)
      if (aiReplyTimeoutRef.current) clearTimeout(aiReplyTimeoutRef.current)
      try {
        const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) })
        if (!res.ok) setAiTyping(false)
        else {
          aiReplyTimeoutRef.current = setTimeout(async () => {
            const reply = await fetchBotReplyAfter(supabase, roomId, sentAt)
            if (reply) {
              setMessages(prev => (prev.find(p => p.id === reply.id) ? prev : [...prev, reply]))
              setAiTyping(false)
            } else {
              setAiTyping(false)
              setAiTimedOut(true)
            }
          }, AI_REPLY_TIMEOUT_MS)
        }
      } catch { setAiTyping(false) }
    }
  }

  function openSheet(id: string) { setReactingTo(id) }

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
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet{canSend ? ' — say hello' : ''}</p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const isBot = m.sender_id === BOT_USER_ID
          const sender = memberById[m.sender_id]?.users
          const replyParent = parentFor(m)
          const replyParentIsBot = replyParent?.sender_id === BOT_USER_ID
          const replyParentName = replyParentIsBot ? 'AI Coach' : (memberById[replyParent?.sender_id ?? '']?.users?.name ?? '?')
          // Spec §6: "If the original is not in the loaded window, the strip
          // is not tappable." Only offer the jump handler when the parent's
          // bubble actually exists on screen — a parent resolved from
          // initialReplyParents or the lazy fetch lives outside `messages`
          // and has nowhere to scroll to.
          const canJumpToParent = !!m.reply_to_id && messages.some(msg => msg.id === m.reply_to_id)
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.sender_id === currentUserId}
              isBot={isBot}
              showAvatar={m.sender_id !== currentUserId && (!prev || prev.sender_id !== m.sender_id)}
              senderName={isBot ? 'AI Coach' : (sender?.name ?? '?')}
              avatarUrl={sender?.avatar_url ?? null}
              chips={reactionsFor(m.id)}
              attachmentSrc={attachmentSrc}
              onOpenSheet={openSheet}
              onToggleReaction={toggleReaction}
              replyParent={replyParent}
              replyParentName={replyParentName}
              onJumpToMessage={canJumpToParent ? jumpToMessage : undefined}
            />
          )
        })}
        {aiTyping && (
          <div className="flex items-end gap-1.5 justify-start">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 text-white shrink-0"><Bot size={14} /></span>
            <div className="bg-white border px-3 py-2.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {aiTimedOut && !aiTyping && <p className="text-xs text-muted-foreground px-1">Taking longer than usual — try refreshing in a moment.</p>}
        {typingUsers.length > 0 && !aiTyping && (
          <p className="text-xs text-muted-foreground px-1 animate-pulse">{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…</p>
        )}
      </div>
      {attachment && (
        <div className="bg-white border-t px-3 py-2 flex items-center gap-2 shrink-0">
          {attachment.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span className="text-sm text-muted-foreground truncate">{attachment.file.name}</span>
          )}
          <button onClick={() => setAttachment(null)} className="ml-auto text-gray-400 hover:text-gray-600 shrink-0"><X size={16} /></button>
        </div>
      )}
      {replyingTo && (
        <ReplyQuote
          parent={{
            id: replyingTo.id,
            sender_id: replyingTo.sender_id,
            body: replyingTo.body,
            attachment_kind: replyingTo.attachment_kind,
            deleted_at: null,
          }}
          senderName={replyingTo.sender_id === BOT_USER_ID ? 'AI Coach' : (memberById[replyingTo.sender_id]?.users?.name ?? '?')}
          variant="composer"
          onCancel={() => setReplyingTo(null)}
        />
      )}
      {canSend ? (
        <div className="bg-white border-t p-2 flex items-end gap-2 shrink-0 safe-bottom">
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv" className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-tranmere-blue shrink-0" type="button" aria-label="Attach file"><Paperclip size={18} /></button>
          <textarea ref={textareaRef} value={draft} onChange={e => handleDraftChange(e.target.value)} onKeyDown={e => {
            if (e.key !== 'Enter' || e.shiftKey) return
            if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return
            e.preventDefault(); send()
          }} placeholder="Message…" rows={1} className="flex-1 text-sm border rounded-2xl px-3 py-2 resize-none focus:ring-2 focus:ring-tranmere-blue outline-none max-h-32 overflow-y-auto" />
          <button onClick={send} disabled={(!draft.trim() && !attachment) || sending} aria-label="Send message" className="rounded-full bg-tranmere-blue text-white w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-50"><Send size={16} /></button>
        </div>
      ) : (
        <div className="bg-gray-50 border-t p-3 text-center text-xs text-muted-foreground safe-bottom">This is a broadcast channel — only staff can post.</div>
      )}
      {reactingTo && (
        <MessageReactionSheet
          mine={messages.find(m => m.id === reactingTo)?.sender_id === currentUserId}
          deleting={deletingId === reactingTo}
          onPick={emoji => { toggleReaction(reactingTo, emoji); setReactingTo(null) }}
          onReply={() => { setReplyingTo(messages.find(m => m.id === reactingTo) ?? null); setReactingTo(null) }}
          onDelete={() => { deleteMessage(reactingTo); setReactingTo(null) }}
          onClose={() => setReactingTo(null)}
        />
      )}
    </>
  )
}
