'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { MessageSquare, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getPlatform, isNative } from '@/lib/native'
import type { UnreadLatest } from '@/lib/chat/unread'
import { isChatListPath, shouldShowBanner, viewingRoomFrom } from '@/lib/chat/bannerLogic'
import { playPing, unlockPing } from '@/lib/chat/ping'

const UnreadContext = createContext<{ total: number }>({ total: 0 })

/** Unread chat message count for nav badges. 0 when signed out. */
export function useChatUnread() {
  return useContext(UnreadContext)
}

export const BANNER_MS = 6000

/**
 * App-wide new-message banner + unread count. Mounted once in the root
 * layout so one realtime subscription serves every page and every nav.
 *
 * Why it exists: Android native push is disabled (components/PushOptIn.tsx),
 * so an Android user got no alert for a new message unless they were already
 * inside that chat. This works on every platform without push.
 *
 * The realtime event only says "something arrived"; the server endpoint
 * decides the count and who it was from, so RLS and membership stay the
 * single source of truth.
 */
export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [banner, setBanner] = useState<UnreadLatest | null>(null)
  const lastShownId = useRef<string | null>(null)
  const requestSeq = useRef(0)
  const viewingRef = useRef<string | null>(null)
  // iOS native with push allowed already gets the OS banner in the foreground
  // (capacitor.config presentationOptions includes 'alert'); a second in-app
  // one on top would be noise. The badge still updates.
  const suppressBanner = useRef(false)

  const viewing = viewingRoomFrom(pathname)
  viewingRef.current = viewing
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const refresh = useCallback(async (fromArrival: boolean) => {
    const seq = ++requestSeq.current
    const room = viewingRef.current
    try {
      const res = await fetch(`/api/chat/unread${room ? `?viewing=${room}` : ''}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json() as { ok: boolean; total: number; latest: UnreadLatest | null }
      if (!json.ok || seq !== requestSeq.current) return
      setTotal(json.total)
      if (shouldShowBanner({
        latest: json.latest,
        fromArrival,
        lastShownId: lastShownId.current,
        viewingRoomId: viewingRef.current,
        suppressed: suppressBanner.current,
      })) {
        lastShownId.current = json.latest!.id
        setBanner(json.latest)
        playPing()
      }
    } catch {
      // Offline or mid-deploy: keep the last count, try again on the next trigger.
    }
  }, [])

  // Who is signed in. Follows sign-in/out without a reload (the provider
  // lives in the root layout and survives client-side navigation).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)).catch(() => {})
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isNative() || getPlatform() !== 'ios') return
    import('@capacitor/push-notifications')
      .then(({ PushNotifications }) => PushNotifications.checkPermissions())
      .then(p => { suppressBanner.current = p.receive === 'granted' })
      .catch(() => {})
  }, [])

  // One realtime subscription for the whole app. RLS (migration 056) only
  // delivers messages from rooms this user is a member of.
  useEffect(() => {
    if (!userId) {
      setTotal(0)
      setBanner(null)
      return
    }
    const supabase = createClient()
    const channel = supabase
      .channel(`chat-unread:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const row = payload.new as { sender_id?: string }
        if (!row.sender_id || row.sender_id === userId) return
        refresh(true)
        // The chat list is server-rendered: re-fetch it so the room that
        // just got a message jumps to the top while you're looking at it.
        if (isChatListPath(pathnameRef.current)) router.refresh()
      })
      .subscribe()

    // Mobile browsers drop sockets in the background: catch up on return.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(false) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [userId, refresh, router])

  // Audio can only start after a user gesture; unlock on the first tap.
  useEffect(() => {
    const unlock = () => unlockPing()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Recount on every navigation: opening a room marks it read.
  useEffect(() => {
    if (userId) refresh(false)
  }, [userId, pathname, refresh])

  // Opening the banner's room makes it stale.
  useEffect(() => {
    if (banner && viewing === banner.roomId) setBanner(null)
  }, [viewing, banner])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), BANNER_MS)
    return () => clearTimeout(t)
  }, [banner])

  return (
    <UnreadContext.Provider value={{ total: userId ? total : 0 }}>
      {children}
      {banner && (
        <div className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pointer-events-none safe-top">
          <div
            role="status"
            data-testid="new-message-banner"
            className="pointer-events-auto mt-2 w-full max-w-md flex items-start gap-3 rounded-2xl bg-white shadow-lg ring-1 ring-black/5 p-3 animate-in slide-in-from-top-4 fade-in duration-300"
          >
            <button
              onClick={() => { setBanner(null); router.push(`/chat/${banner.roomId}`) }}
              className="flex flex-1 min-w-0 items-start gap-3 text-left"
            >
              <span className="shrink-0 w-9 h-9 rounded-full bg-tranmere-blue text-white flex items-center justify-center">
                <MessageSquare size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-tranmere-blue truncate">
                  {banner.senderName === banner.roomLabel ? banner.senderName : `${banner.senderName} · ${banner.roomLabel}`}
                </span>
                <span className="block text-sm text-gray-700 line-clamp-2">{banner.preview}</span>
              </span>
            </button>
            <button onClick={() => setBanner(null)} aria-label="Dismiss" className="shrink-0 p-1 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </UnreadContext.Provider>
  )
}
