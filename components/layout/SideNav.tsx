'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Apple, Dumbbell, Trophy, User, LogOut, Activity } from 'lucide-react'
import Image from 'next/image'
import { signOut } from '@/app/(auth)/login/actions'

const nav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/coursework', label: 'BTEC Coursework', icon: BookOpen },
  { href: '/nutrition', label: 'Nutrition', icon: Apple },
  { href: '/gps', label: 'GPS Dashboard', icon: Activity },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
]

export function SideNav() {
  const pathname = usePathname()
  return (
    <aside className="w-56 bg-tranmere-blue flex flex-col min-h-[100dvh] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <Image
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          width={36}
          height={36}
        />
        <div>
          <p className="text-white font-bold text-sm leading-tight">Tranmere</p>
          <p className="text-white/60 text-xs">Tracker</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <form action={signOut} className="px-3 pb-5">
        <button
          type="submit"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </form>
    </aside>
  )
}
