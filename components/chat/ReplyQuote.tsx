'use client'

import { X } from 'lucide-react'
import type { ReplyParent } from '@/lib/chat/types'

export type ReplyQuoteProps = {
  parent: ReplyParent | null
  senderName: string
  variant: 'composer' | 'bubble'
  mine?: boolean
  onCancel?: () => void
  onJump?: () => void
}

/** One line describing the quoted message. A parent that is missing or
 *  soft-deleted reads "Message deleted" rather than rendering an empty
 *  quote — the row still exists but every normal read filters it out. */
function excerpt(parent: ReplyParent | null): string {
  if (!parent || parent.deleted_at) return 'Message deleted'
  if (parent.body?.trim()) return parent.body.trim()
  if (parent.attachment_kind === 'image') return 'Photo'
  if (parent.attachment_kind === 'file') return 'Attachment'
  // A poll carrier message has no body and no attachment. Without this
  // branch it would fall through to "Message deleted" and a reply to a live
  // open poll would permanently quote it as gone.
  if (parent.poll_id) return 'Poll'
  return 'Message deleted'
}

export function ReplyQuote({ parent, senderName, variant, mine, onCancel, onJump }: ReplyQuoteProps) {
  const text = excerpt(parent)
  const gone = text === 'Message deleted'

  const body = (
    <span className="flex flex-col items-start text-left min-w-0 w-full">
      {senderName && <span className="text-[10px] font-semibold opacity-80">{senderName}</span>}
      <span className={`text-[11px] truncate max-w-full ${gone ? 'italic opacity-60' : 'opacity-80'}`}>
        {text}
      </span>
    </span>
  )

  if (variant === 'composer') {
    return (
      <div className="bg-white border-t px-3 py-2 flex items-center gap-2 shrink-0">
        <div className="border-l-2 border-tranmere-blue pl-2 flex-1 min-w-0 text-gray-700">{body}</div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel reply"
          className="ml-auto text-gray-400 hover:text-gray-600 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  const className = `border-l-2 pl-2 mb-1 w-full block ${
    mine ? 'border-white/50 text-white' : 'border-tranmere-blue/50 text-gray-700'
  }`

  if (!onJump) return <div className={className}>{body}</div>

  return (
    <button type="button" onClick={onJump} className={className}>
      {body}
    </button>
  )
}
