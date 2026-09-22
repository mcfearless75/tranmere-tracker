'use client'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import {
  RoleSelect,
  YearGroupSelect,
  CourseSelect,
  TeamSelect,
  type UserListItem,
  type Course,
} from './UserFields'
import type { Team } from '@/lib/teams/types'

interface Props {
  user: UserListItem
  courses: Course[]
  teams: Team[]
}

/**
 * Desktop (sm and up) table row. The phone layout is UserCard — this table is
 * min-w-[600px] inside a horizontal scroller, which put the Role/Year/Course
 * controls off-screen on a phone.
 */
export function UserRow({ user, courses, teams }: Props) {
  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        <Link
          href={`/admin/students/${user.id}`}
          className="font-medium text-tranmere-blue hover:underline inline-flex items-center gap-1.5"
        >
          {user.name}
          <Eye size={12} className="opacity-60" />
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">{user.email}</td>
      <td className="px-4 py-3">
        <RoleSelect user={user} />
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
        <YearGroupSelect user={user} />
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
        <TeamSelect user={user} teams={teams} />
      </td>
      <td className="px-4 py-3">
        <CourseSelect user={user} courses={courses} className="max-w-[180px]" />
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(user.created_at).toLocaleDateString('en-GB')}
      </td>
    </tr>
  )
}
