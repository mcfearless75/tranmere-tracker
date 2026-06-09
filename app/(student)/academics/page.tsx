import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GraduationCap, ChevronRight } from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

export const dynamic = 'force-dynamic'

export default async function AcademicsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-tranmere-blue">Academic Progress</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your coursework lives in Moodle</p>
      </div>

      {/* Moved-to-Moodle card */}
      <a
        href={MOODLE_STUDENT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow group"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <GraduationCap size={24} className="text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-gray-900">Academic progress has moved to Moodle</p>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">
              All your grades, units and assignments are now in Moodle. Tap below to open it.
            </p>
            <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-tranmere-blue group-hover:gap-2 transition-all">
              Open Moodle
              <ChevronRight size={16} />
            </span>
          </div>
        </div>
      </a>
    </div>
  )
}
