'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, BookOpen, Calendar, MessageSquare } from 'lucide-react'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/parent/attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/parent/coursework', label: 'Coursework', icon: BookOpen },
  { href: '/parent/matches', label: 'Matches', icon: Calendar },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
]

export function MobileParentBar() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 safe-area-inset-bottom">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-tranmere-blue' : 'text-gray-400'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
