'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Heart, CalendarDays, CalendarClock, Dumbbell, Target, FolderOpen, ClipboardCheck } from 'lucide-react'

type Props = { showTimetable?: boolean; showCoursework?: boolean }

export function BottomNav({ showTimetable = false, showCoursework = false }: Props) {
  const pathname = usePathname()
  const nav = [
    { href: '/dashboard',  label: 'Home',      icon: Home },
    { href: '/documents',  label: 'Documents', icon: FolderOpen },
    { href: '/calendar',   label: 'Calendar',  icon: CalendarDays },
    ...(showTimetable ? [{ href: '/timetable', label: 'Timetable', icon: CalendarClock }] : []),
    ...(showCoursework ? [{ href: '/coursework', label: 'Coursework', icon: ClipboardCheck }] : []),
    { href: '/gym',        label: 'Gym',        icon: Dumbbell },
    { href: '/targets',    label: 'Targets',   icon: Target },
    { href: '/wellbeing',  label: 'Wellbeing', icon: Heart },
    { href: '/profile',    label: 'Profile',   icon: User },
  ]
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
            <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
