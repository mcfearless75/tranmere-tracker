'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Heart, CalendarDays, CalendarClock, Dumbbell, Target, FolderOpen, ClipboardCheck, MessageSquare, MoreHorizontal, X } from 'lucide-react'

type Props = { showTimetable?: boolean; showCoursework?: boolean }

// Always-visible tabs. Kept to 4 + More so icons/labels stay readable on a
// narrow phone screen instead of shrinking to fit an ever-growing row.
const PRIMARY = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/chat',      label: 'Chat', icon: MessageSquare },
  { href: '/calendar',  label: 'Calendar', icon: CalendarDays },
  { href: '/profile',   label: 'Profile', icon: User },
]

export function BottomNav({ showTimetable = false, showCoursework = false }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const more = [
    { href: '/documents',  label: 'Documents', icon: FolderOpen },
    ...(showTimetable ? [{ href: '/timetable', label: 'Timetable', icon: CalendarClock }] : []),
    ...(showCoursework ? [{ href: '/coursework', label: 'Coursework', icon: ClipboardCheck }] : []),
    { href: '/gym',        label: 'Gym',       icon: Dumbbell },
    { href: '/targets',    label: 'Targets',   icon: Target },
    { href: '/wellbeing',  label: 'Wellbeing', icon: Heart },
  ]
  const moreActive = more.some(({ href }) => pathname === href || pathname.startsWith(href + '/'))

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {/* "More" sheet — everything that doesn't fit in the primary row */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        role="dialog"
        aria-label="More"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <p className="text-sm font-semibold text-tranmere-blue">More</p>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {more.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium ${active ? 'text-tranmere-blue bg-tranmere-blue/10' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 safe-area-inset-bottom">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-tranmere-blue' : 'text-gray-400'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${moreActive || open ? 'text-tranmere-blue' : 'text-gray-400'}`}
          aria-expanded={open}
        >
          <MoreHorizontal size={20} strokeWidth={moreActive || open ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </nav>
    </>
  )
}
