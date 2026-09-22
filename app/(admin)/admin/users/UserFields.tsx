'use client'

import { useState, useTransition } from 'react'
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

const SAVE_FAILED = 'Not saved — try again'

/**
 * Drives one of these selects.
 *
 * These were previously uncontrolled (`defaultValue`) and called their action
 * inside a bare `startTransition`. A Server Action REJECTS, rather than
 * returning an error, when the request itself fails — offline, a 5xx, a
 * deploy landing mid-call — and these actions also throw outright on a
 * refused permission. Either way nothing caught it, and because the select
 * was uncontrolled the DOM kept showing the value the user picked. The
 * control silently claimed a change that was never saved, which is precisely
 * the "I set their year group and it didn't stick" complaint this page has
 * already produced once.
 *
 * So: controlled, optimistic, and reverted to the last known-good value if
 * the save does not land.
 *
 * Note the message is deliberately generic. Next.js redacts Server Action
 * errors in production, so the real reason ("Only an admin can grant staff
 * roles") is not available to us here — claiming a specific cause would be a
 * guess. Making these actions return {ok, error} instead of throwing would
 * fix that properly, and is a bigger change than this one.
 */
function useSavedSelect<T>(initial: T, save: (next: T) => Promise<unknown>) {
  const [value, setValue] = useState<T>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function change(next: T) {
    const previous = value
    setValue(next)
    setError(null)
    start(async () => {
      try {
        await save(next)
      } catch {
        setValue(previous)
        setError(SAVE_FAILED)
      }
    })
  }

  return { value, change, error, pending }
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return <span className="block text-[11px] text-red-600 mt-0.5">{message}</span>
}

export function RoleSelect({ user, className = '' }: { user: UserListItem; className?: string }) {
  const { value, change, error, pending } = useSavedSelect(user.role, next =>
    updateUserRole(user.id, next)
  )
  return (
    <>
      <select
        aria-label={`Role for ${user.name}`}
        value={value}
        disabled={pending}
        onChange={e => change(e.target.value)}
        className={`text-xs px-2 py-0.5 rounded-full font-medium border-none outline-none cursor-pointer disabled:opacity-60 ${roleColor[value] ?? 'bg-gray-100'} ${className}`}
      >
        {['student', 'coach', 'teacher', 'admin'].map(r => (
          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
        ))}
      </select>
      <FieldError message={error} />
    </>
  )
}

/**
 * year_group defaults to 1 at the DB level for every row, staff included —
 * it is only meaningful for students, so staff render as a dash. Changing it
 * also moves the student between the auto-synced Year 1/2 chats, via the
 * sync_year_group_chat trigger.
 */
export function YearGroupSelect({ user, className = '' }: { user: UserListItem; className?: string }) {
  const { value, change, error, pending } = useSavedSelect(user.year_group ?? 1, next =>
    updateUserYearGroup(user.id, next)
  )
  if (user.role !== 'student') return <span className="text-muted-foreground">—</span>
  return (
    <>
      <select
        aria-label={`Year group for ${user.name}`}
        value={value}
        disabled={pending}
        onChange={e => change(Number(e.target.value))}
        className={`text-xs border rounded px-1 py-0.5 bg-white cursor-pointer disabled:opacity-60 ${className}`}
      >
        <option value={1}>Year 1</option>
        <option value={2}>Year 2</option>
      </select>
      <FieldError message={error} />
    </>
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
  const { value, change, error, pending } = useSavedSelect(user.course_id ?? '', next =>
    updateUserCourse(user.id, next)
  )
  return (
    <>
      <select
        aria-label={`Course for ${user.name}`}
        value={value}
        disabled={pending}
        onChange={e => change(e.target.value)}
        className={`text-xs text-muted-foreground border rounded px-1 py-0.5 bg-white cursor-pointer disabled:opacity-60 ${className}`}
      >
        <option value="">No course</option>
        {courses.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <FieldError message={error} />
    </>
  )
}
