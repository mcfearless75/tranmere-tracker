'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, BookOpen, Bell, BarChart2, GraduationCap, LogOut, Calendar, Star, Wifi, Activity, LayoutGrid, Plug, MessageSquare, Megaphone, Home } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/courses', label: 'Courses', icon: GraduationCap },
  { href: '/admin/assignments', label: 'Assignments', icon: BookOpen },
  { href: '/admin/match-events', label: 'Match Squads', icon: Calendar },
  { href: '/admin/formation', label: 'Formation', icon: LayoutGrid },
  { href: '/admin/grade-submissions', label: 'Grade Work', icon: Star },
  { href: '/admin/gps-dashboard', label: 'Squad GPS', icon: Activity },
  { href: '/admin/gps-import', label: 'GPS Import', icon: Wifi },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { href: '/admin/lti', label: 'Moodle / LTI', icon: Plug },
]

type Props = { userName: string; avatarUrl: string | null; role: string }

export function AdminSidebar({ userName, avatarUrl, role }: Props) {
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
          <p className="text-xs text-blue-200 leading-tight">Admin Panel</p>
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
          <p className="text-white/60 text-xs capitalize">{role}</p>
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
