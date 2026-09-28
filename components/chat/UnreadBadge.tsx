'use client'

import { useChatUnread } from '@/components/chat/ChatUnreadProvider'
import { badgeLabel } from '@/lib/chat/bannerLogic'

/**
 * Red unread-count pill for a Chat nav icon. Position it with `className`
 * (e.g. absolute over the icon in a tab bar, inline in a sidebar row).
 */
export function UnreadBadge({ className = '' }: { className?: string }) {
  const label = badgeLabel(useChatUnread().total)
  if (!label) return null
  return (
    <span
      data-testid="chat-unread-badge"
      aria-label={`${label} unread messages`}
      className={`min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[18px] text-center ${className}`}
    >
      {label}
    </span>
  )
}
