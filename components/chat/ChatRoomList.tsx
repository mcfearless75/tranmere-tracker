'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, Crown, Trophy, Search, X, UserPlus } from 'lucide-react'
import { ChatRoomActions } from '@/app/chat/ChatRoomActions'
import { getOrCreateDM } from '@/app/chat/actions'
import { searchNewPeople, searchRooms } from '@/lib/chat/search'

export type ChatListRoom = {
  id: string
  kind: string
  label: string
  otherUserId: string | null
  avatarUrl: string | null
  memberNames: string[]
  lastMessage: string | null
  unread: number
  isOwner: boolean
  syncYearGroup: number | null
}

export type ChatListPerson = { id: string; name: string | null; role: string; avatar_url: string | null }

function initialsOf(name: string | null): string {
  return (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function ChatRoomList({ rooms, directory }: { rooms: ChatListRoom[]; directory: ChatListPerson[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [opening, setOpening] = useState<string | null>(null)

  const results = searchRooms(rooms, q)
  const newPeople = searchNewPeople(directory, rooms, q)
  const searching = q.trim().length > 0

  async function startDm(userId: string) {
    setOpening(userId)
    const res = await getOrCreateDM(userId)
    setOpening(null)
    if (typeof res === 'string') router.push(`/chat/${res}`)
    else alert(`Error: ${res.error}`)
  }

  return (
    <>
      {rooms.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search chats or names…"
            aria-label="Search chats"
            className="w-full pl-9 pr-9 py-2.5 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-tranmere-blue outline-none"
          />
          {searching && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {searching && results.length === 0 && newPeople.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">No chats or people match “{q.trim()}”</p>
      )}

      {results.length > 0 && (
        <div className="rounded-2xl border bg-white divide-y">
          {results.map(({ room: r, viaMember }) => {
            const kindIcon = r.kind === 'squad' ? <Users size={12} /> : r.kind === 'match' ? <Trophy size={12} /> : r.kind === 'broadcast' ? <Crown size={12} /> : null
            const isDmOrBot = ['dm', 'bot'].includes(r.kind)
            return (
              <div key={r.id} className="flex items-center hover:bg-gray-50 active:bg-gray-100 pr-2">
                <Link href={`/chat/${r.id}`} className="flex flex-1 items-center gap-3 p-3 min-w-0">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {initialsOf(r.label)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <p className="font-semibold line-clamp-2 break-words">{r.label}</p>
                      {kindIcon && <span className="text-muted-foreground shrink-0 mt-0.5">{kindIcon}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {viaMember
                        ? <>Includes <span className="font-medium text-gray-700">{viaMember}</span></>
                        : (r.lastMessage ?? <span className="italic">No messages yet</span>)}
                    </p>
                  </div>
                  {r.unread > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-tranmere-blue text-white text-[11px] font-bold px-1.5">
                      {r.unread}
                    </span>
                  )}
                </Link>
                <ChatRoomActions roomId={r.id} isOwner={r.isOwner} isDmOrBot={isDmOrBot} canLeave={!r.syncYearGroup} />
              </div>
            )
          })}
        </div>
      )}

      {newPeople.length > 0 && (
        <div className="rounded-2xl border bg-white p-2 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 pt-1">Start a new chat</p>
          {newPeople.map(p => (
            <button key={p.id} type="button" onClick={() => startDm(p.id)} disabled={opening === p.id}
              className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-left disabled:opacity-50">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-tranmere-blue text-white text-xs font-bold shrink-0">
                  {initialsOf(p.name)}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{p.name}</span>
                <span className="block text-xs text-muted-foreground capitalize">{p.role}</span>
              </span>
              {opening === p.id ? <span className="text-xs text-muted-foreground">Opening…</span> : <UserPlus size={14} className="text-tranmere-blue" />}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
