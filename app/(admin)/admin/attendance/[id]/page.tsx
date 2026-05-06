import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Per-session PIN view retired in favour of the daily NFC tap-in roster.
// Any deep link to a specific session now goes to the daily attendance page.
export default function LegacyAttendanceSessionRedirect() {
  redirect('/admin/attendance')
}
