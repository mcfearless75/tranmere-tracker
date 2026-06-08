import Link from 'next/link'
import { Heart } from 'lucide-react'

export function WellbeingPromptCard() {
  return (
    <Link
      href="/wellbeing"
      className="block rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-4 shadow group"
    >
      <div className="flex items-center gap-2 mb-2">
        <Heart size={15} className="text-rose-200 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-rose-200">Wellbeing Check-in</span>
      </div>
      <p className="text-sm font-semibold leading-snug">Your fortnightly wellbeing survey is ready.</p>
      <p className="text-xs text-rose-100 mt-1">Takes 1 minute — tap to complete survey →</p>
    </Link>
  )
}
