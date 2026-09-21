'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, X, UserPlus, Users, MessageSquare, Pencil, Check } from 'lucide-react'
import { addGroupMembers, removeGroupMember, renameGroupChat, joinGroupChat } from '@/app/chat/actions'

type Person = { id: string; name: string | null; role: string }

export function ChatGroupCard({
  roomId,
  roomName,
  syncYearGroup,
  members,
  addable,
}: {
  roomId: string
  roomName: string
  syncYearGroup: number | null
  members: Person[]
  addable: Person[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(roomName)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const filtered = query.trim()
    ? addable.filter(p => (p.name ?? '').toLowerCase().includes(query.toLowerCase()))
    : addable

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submitAdd() {
    setError(null)
    if (selected.size === 0) { setError('Pick at least one person'); return }
    start(async () => {
      const res = await addGroupMembers(roomId, Array.from(selected))
      if (res.ok) {
        setAdding(false)
        setSelected(new Set())
        setQuery('')
        router.refresh()
      } else {
        setError(res.error ?? 'Failed to add')
      }
    })
  }

  function handleRemove(userId: string) {
    setError(null)
    setBusyId(userId)
    start(async () => {
      const res = await removeGroupMember(roomId, userId)
      setBusyId(null)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Failed to remove')
    })
  }

  function handleOpen() {
    start(async () => {
      // Idempotent: this page lists every group chat whether or not the
      // viewing staff member is already in it, so "Open" joins first if
      // needed — otherwise there'd be no way to actually read one you'd
      // never been added to.
      await joinGroupChat(roomId)
      router.push(`/chat/${roomId}`)
    })
  }

  function startRename() {
    setRenameError(null)
    setNameInput(roomName)
    setRenaming(true)
    setExpanded(true)
  }

  function submitRename() {
    setRenameError(null)
    const trimmed = nameInput.trim()
    if (!trimmed) { setRenameError('Give the group a name'); return }
    start(async () => {
      const res = await renameGroupChat(roomId, trimmed)
      if (res.ok) {
        setRenaming(false)
        router.refresh()
      } else {
        setRenameError(res.error ?? 'Failed to rename')
      }
    })
  }

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-1 p-4 hover:bg-gray-50 transition-colors">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center shrink-0">
            <Users size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold line-clamp-2 break-words">{roomName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {members.length} members
              {syncYearGroup && (
                <span className="text-[10px] font-medium text-tranmere-blue bg-tranmere-blue/10 px-2 py-0.5 rounded-full">
                  Auto-synced student roster
                </span>
              )}
            </p>
          </div>
        </button>
        <button
          onClick={handleOpen}
          disabled={pending}
          aria-label="Open chat"
          title="Open chat"
          className="p-2 rounded-lg text-tranmere-blue hover:bg-tranmere-blue/10 disabled:opacity-50 shrink-0"
        >
          <MessageSquare size={16} />
        </button>
        <button
          onClick={startRename}
          aria-label="Rename group"
          title="Rename group"
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 shrink-0"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="p-1.5 shrink-0"
        >
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 p-4 space-y-3">
          {renaming && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  maxLength={60}
                  placeholder="Group name"
                  className="flex-1 px-2 py-1.5 border rounded-lg text-sm"
                />
                <button
                  onClick={submitRename}
                  disabled={pending}
                  aria-label="Save name"
                  className="p-2 rounded-lg bg-tranmere-blue text-white disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setRenaming(false); setRenameError(null) }}
                  aria-label="Cancel rename"
                  className="p-2 rounded-lg hover:bg-gray-200"
                >
                  <X size={14} />
                </button>
              </div>
              {renameError && <p className="text-xs text-red-600">{renameError}</p>}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {members
              .slice()
              .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
              .map(m => {
                // Matches the server-side rule in removeGroupMember: a
                // student's spot in an auto-synced roster is trigger-managed,
                // not manually editable. Staff can still be removed even from
                // a synced room.
                const canRemove = !(syncYearGroup && m.role === 'student')
                return (
                  <div key={m.id} className="flex items-center gap-2 text-sm py-1 bg-white rounded-lg px-2.5">
                    <span className="flex-1 truncate">{m.name ?? 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
                    {canRemove && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        disabled={pending && busyId === m.id}
                        aria-label={`Remove ${m.name ?? 'member'}`}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50 ml-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
          </div>

          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-tranmere-blue"
            >
              <UserPlus size={13} /> Add people
            </button>
          ) : (
            <div className="border rounded-xl p-2 space-y-2 bg-white">
              {/* Students are filtered out of `addable` on a synced room, so
                  searching for a learner here silently returns "No match".
                  Explain that up front rather than leaving staff guessing. */}
              {syncYearGroup && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Only staff can be added here. Learners join automatically from their year
                  group — to add one, set their year group to {syncYearGroup} on their profile.
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search people…"
                  className="flex-1 px-2 py-1.5 border rounded-lg text-xs"
                />
                <button
                  onClick={() => { setAdding(false); setSelected(new Set()); setQuery('') }}
                  aria-label="Close"
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {addable.length === 0 ? 'Everyone who can be added is already in' : 'No match'}
                  </p>
                )}
                {filtered.map(p => {
                  const checked = selected.has(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelected(p.id)}
                      className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left text-xs ${checked ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                    >
                      <input type="checkbox" checked={checked} readOnly />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{p.role}</span>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={submitAdd}
                disabled={pending}
                className="w-full rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {pending ? 'Adding…' : `Add${selected.size ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
