'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, BookOpen, Calendar, MessageSquare, LogOut } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/parent/attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/parent/coursework', label: 'Coursework', icon: BookOpen },
  { href: '/parent/matches', label: 'Matches', icon: Calendar },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
]

type Props = { userName: string; avatarUrl: string | null }

export function ParentSidebar({ userName, avatarUrl }: Props) {
  const pathname = usePathname()
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <aside className="w-56 min-h-screen bg-tranmere-blue text-white flex flex-col shrink-0">
      {/* Top brand */}
      <div className="flex items-center gap-2 p-4 border-b border-blue-800">
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={32}
          height={32}
        />
        <div>
          <p className="font-bold text-sm leading-tight">Tranmere</p>
          <p className="text-xs text-blue-200 leading-tight">Parent Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              pathname.startsWith(href)
                ? 'bg-white/20 font-semibold'
                : 'hover:bg-white/10 text-blue-100'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logged-in user card */}
      <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={userName} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{userName}</p>
          <p className="text-white/60 text-xs">Parent</p>
        </div>
      </div>

      {/* Sign out */}
      <div className="p-3 border-t border-blue-800">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-white/10 w-full"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
