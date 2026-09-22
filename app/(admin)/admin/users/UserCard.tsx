'use client'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  RoleSelect,
  YearGroupSelect,
  CourseSelect,
  TeamSelect,
  type UserListItem,
  type Course,
} from './UserFields'
import type { Team } from '@/lib/teams/types'

/**
 * Phone layout for a user.
 *
 * The desktop table is min-w-[600px] inside an overflow-x-auto wrapper, so on
 * a ~390px screen the Role, Year and Course controls sat off to the right
 * behind a horizontal scroll — present but unreachable in practice, which is
 * how "you can't change a student's year group" went unnoticed after the
 * control had shipped. This stacks the same controls vertically so every one
 * of them is on screen.
 */
export function UserCard({
  user, courses, teams,
}: {
  user: UserListItem
  courses: Course[]
  teams: Team[]
}) {
  return (
    <div className="border-b last:border-0 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/admin/students/${user.id}`}
            className="font-medium text-tranmere-blue hover:underline inline-flex items-center gap-1 break-words"
          >
            {user.name}
            <ChevronRight size={14} className="opacity-60 shrink-0" />
          </Link>
          <p className="text-xs text-muted-foreground break-all">{user.email}</p>
        </div>
        <RoleSelect user={user} className="shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Year</span>
          <div className="mt-0.5">
            <YearGroupSelect user={user} className="w-full py-1.5" />
          </div>
        </label>
        <label className="block min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Course</span>
          <div className="mt-0.5">
            <CourseSelect user={user} courses={courses} className="w-full py-1.5" />
          </div>
        </label>
      </div>

      {/* Full width, not squeezed into the two-column grid above — renders for
          every role, not just students (a coach who plays needs a team). */}
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Team</span>
        <div className="mt-0.5">
          <TeamSelect user={user} teams={teams} className="w-full py-1.5" />
        </div>
      </label>

      <p className="text-[11px] text-muted-foreground">
        Joined {new Date(user.created_at).toLocaleDateString('en-GB')}
      </p>
    </div>
  )
}
