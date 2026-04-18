'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, BookOpen, Bell, BarChart2, GraduationCap, LogOut } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'

const nav = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/courses', label: 'Courses', icon: GraduationCap },
  { href: '/admin/assignments', label: 'Assignments', icon: BookOpen },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/reports', label: 'Reports', icon: BarChart2 },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-tranmere-blue text-white flex flex-col shrink-0">
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
      <nav className="flex-1 p-3 space-y-1">
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
