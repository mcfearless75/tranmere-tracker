'use client'

import { useTransition } from 'react'
import { updateUserRole, updateUserCourse, updateUserYearGroup } from './userActions'

/**
 * The three editable controls on a user, shared by the desktop table row
 * (UserRow) and the mobile card (UserCard).
 *
 * They live here rather than being written twice because the duplication that
 * matters is not the markup, it is the action wiring — a control that exists
 * in one layout and not the other is exactly the bug this whole change is
 * fixing. Sharing them makes the two layouts identical by construction.
 */

export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  course_id: string | null
  created_at: string
  year_group: number | null
  courses: { name: string } | null
}

export interface Course {
  id: string
  name: string
}

export const roleColor: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  coach: 'bg-green-100 text-green-700',
  teacher: 'bg-amber-100 text-amber-700',
  admin: 'bg-purple-100 text-purple-700',
}

export function RoleSelect({ user, className = '' }: { user: UserListItem; className?: string }) {
  const [, start] = useTransition()
  return (
    <select
      aria-label={`Role for ${user.name}`}
      defaultValue={user.role}
      onChange={e => start(() => updateUserRole(user.id, e.target.value))}
      className={`text-xs px-2 py-0.5 rounded-full font-medium border-none outline-none cursor-pointer ${roleColor[user.role] ?? 'bg-gray-100'} ${className}`}
    >
      {['student', 'coach', 'teacher', 'admin'].map(r => (
        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
      ))}
    </select>
  )
}

/**
 * year_group defaults to 1 at the DB level for every row, staff included —
 * it is only meaningful for students, so staff render as a dash. Changing it
 * also moves the student between the auto-synced Year 1/2 chats, via the
 * sync_year_group_chat trigger.
 */
export function YearGroupSelect({ user, className = '' }: { user: UserListItem; className?: string }) {
  const [, start] = useTransition()
  if (user.role !== 'student') return <span className="text-muted-foreground">—</span>
  return (
    <select
      aria-label={`Year group for ${user.name}`}
      defaultValue={user.year_group ?? 1}
      onChange={e => start(() => updateUserYearGroup(user.id, Number(e.target.value)))}
      className={`text-xs border rounded px-1 py-0.5 bg-white cursor-pointer ${className}`}
    >
      <option value={1}>Year 1</option>
      <option value={2}>Year 2</option>
    </select>
  )
}

export function CourseSelect({
  user,
  courses,
  className = '',
}: {
  user: UserListItem
  courses: Course[]
  className?: string
}) {
  const [, start] = useTransition()
  return (
    <select
      aria-label={`Course for ${user.name}`}
      defaultValue={user.course_id ?? ''}
      onChange={e => start(() => updateUserCourse(user.id, e.target.value))}
      className={`text-xs text-muted-foreground border rounded px-1 py-0.5 bg-white cursor-pointer ${className}`}
    >
      <option value="">No course</option>
      {courses.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
