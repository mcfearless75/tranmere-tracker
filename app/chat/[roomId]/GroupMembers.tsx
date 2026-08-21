'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Users } from 'lucide-react'
import { removeGroupMember } from '../actions'

type Member = {
  user_id: string
  role: string
  users: { id: string; name: string | null; avatar_url: string | null; role: string } | null
}

export function GroupMembers({
  roomId,
  members,
  currentUserId,
  isStaff,
  syncYearGroup,
}: {
  roomId: string
  members: Member[]
  currentUserId: string
  isStaff: boolean
  syncYearGroup: number | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleRemove(userId: string) {
    setError(null)
    setRemovingId(userId)
    start(async () => {
      const res = await removeGroupMember(roomId, userId)
      setRemovingId(null)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Failed to remove')
    })
  }

  return (
    <div className="border-t bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Users size={13} /> {members.length} members
        </p>
        {syncYearGroup && (
          <span className="text-[10px] font-medium text-tranmere-blue bg-tranmere-blue/10 px-2 py-0.5 rounded-full">
            Auto-synced roster
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {members.map(m => {
          const person = m.users
          const canRemove = isStaff && !syncYearGroup && m.user_id !== currentUserId
          return (
            <div key={m.user_id} className="flex items-center gap-2 text-sm py-1">
              <span className="flex-1 truncate">{person?.name ?? 'Unknown'}</span>
              {canRemove && (
                <button
                  onClick={() => handleRemove(m.user_id)}
                  disabled={pending && removingId === m.user_id}
                  aria-label={`Remove ${person?.name ?? 'member'}`}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
