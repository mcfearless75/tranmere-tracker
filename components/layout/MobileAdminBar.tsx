'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu, X, Users, BookOpen, Bell, BarChart2, GraduationCap, LogOut, Calendar, Star, Wifi, Activity, LayoutGrid, Plug, MessageSquare } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'

const nav = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/courses', label: 'Courses', icon: GraduationCap },
  { href: '/admin/assignments', label: 'Assignments', icon: BookOpen },
  { href: '/admin/match-events', label: 'Match Squads', icon: Calendar },
  { href: '/admin/formation', label: 'Formation', icon: LayoutGrid },
  { href: '/admin/grade-submissions', label: 'Grade Work', icon: Star },
  { href: '/admin/gps-dashboard', label: 'Squad GPS', icon: Activity },
  { href: '/admin/gps-import', label: 'GPS Import', icon: Wifi },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { href: '/admin/lti', label: 'Moodle / LTI', icon: Plug },
]

type Props = { userName: string; avatarUrl: string | null; role: string }

export function MobileAdminBar({ userName, avatarUrl, role }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Close drawer on navigation
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const currentNav = nav.find(n => pathname.startsWith(n.href))

  return (
    <>
      {/* Top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-tranmere-blue text-white flex items-center justify-between px-4 h-14 shadow-md">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg active:bg-white/10"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
            alt="Tranmere Rovers"
            width={24}
            height={24}
          />
          <p className="font-semibold text-sm">{currentNav?.label ?? 'Admin'}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-[100dvh] w-72 bg-tranmere-blue text-white flex flex-col shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-blue-800">
          <div className="flex items-center gap-2">
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
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-lg active:bg-white/10"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5">
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

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-white/20 font-semibold'
                  : 'active:bg-white/10 text-blue-100'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-blue-800">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-blue-200 active:bg-white/10 w-full"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
