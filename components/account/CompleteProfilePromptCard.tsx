import Link from 'next/link'
import { UserCircle2 } from 'lucide-react'

/**
 * Dashboard nudge for a student profile missing avatar/player-attribute
 * fields (see lib/profile/profileCompleteness.ts). Links out to /profile
 * rather than expanding inline — the actual avatar upload (ProfileClient)
 * and attributes form (PlayerAttributesForm) already live together there,
 * so there's nothing worth duplicating on the dashboard itself.
 */
export function CompleteProfilePromptCard() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <UserCircle2 size={18} className="text-tranmere-blue shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900">Finish setting up your profile</p>
          <p className="text-xs text-blue-700 mt-0.5">Add your photo and player details — coaches use this.</p>
        </div>
      </div>
      <Link
        href="/profile"
        className="block w-full text-center rounded-lg bg-tranmere-blue text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        Complete my profile
      </Link>
    </div>
  )
}
