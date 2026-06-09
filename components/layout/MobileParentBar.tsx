'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, GraduationCap, Calendar, MessageSquare, Megaphone } from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

const nav = [
  { href: '/parent/dashboard', label: 'Overview', icon: Home },
  { href: '/parent/attendance', label: 'Attendance', icon: ClipboardList },
  { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
  { href: '/parent/announcements', label: 'News', icon: Megaphone },
  { href: '/parent/matches', label: 'Matches', icon: Calendar },
  { href: '/parent/messages', label: 'Messages', icon: MessageSquare },
]

export function MobileParentBar() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 safe-area-inset-bottom">
      {nav.map(({ href, label, icon: Icon, external }) => {
        const active = !external && (pathname === href || pathname.startsWith(href + '/'))
        const className = `flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-tranmere-blue' : 'text-gray-400'}`
        return external ? (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={className}>
            <Icon size={20} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </a>
        ) : (
          <Link key={href} href={href} className={className}>
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
