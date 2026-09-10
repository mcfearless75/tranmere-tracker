import { MapPin } from 'lucide-react'
import { describeLoginContext } from '@/lib/auth/loginNotice'

/**
 * Login-page notice for students arriving from the check-in sticker.
 * Renders nothing for ordinary visits.
 */
export function CheckInLoginNotice({ next }: { next: string | null | undefined }) {
  const ctx = describeLoginContext(next)
  if (!ctx.checkIn && !ctx.moved) return null

  return (
    <div
      role="status"
      data-testid="checkin-login-notice"
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-left space-y-1"
    >
      {ctx.moved && (
        <p className="text-xs font-semibold text-amber-900">
          We&apos;ve moved to app.thesolarcampus.com.
        </p>
      )}
      <p className="text-xs text-amber-900/90">
        {ctx.checkIn ? 'Checking in? ' : ''}
        Log in once with your usual username and PIN.
      </p>
      {ctx.checkIn && (
        <p className="flex items-start gap-1.5 text-xs text-amber-900/90">
          <MapPin size={14} className="shrink-0 mt-px" />
          <span>When your phone asks for location, tap <span className="font-semibold">Allow</span>.</span>
        </p>
      )}
    </div>
  )
}
