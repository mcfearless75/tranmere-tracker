'use client'

import { useState, useTransition } from 'react'
import { updateUserRole, updateUserCourse, updateUserYearGroup } from './userActions'
import { setUserTeam } from '../teams/teamActions'
import type { Team } from '@/lib/teams/types'

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
  team_id: string | null
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
 * The actions now return {ok, error} rather than throwing, so a refusal
 * arrives with its real reason ("Only an admin can grant staff roles") intact
 * — Next.js would have redacted that had it been thrown. SAVE_FAILED is kept
 * for the one case with genuinely no reason to report: the request never
 * reaching the server, which still rejects.
 */
function useSavedSelect<T>(initial: T, save: (next: T) => Promise<{ ok: boolean; error?: string }>) {
  const [value, setValue] = useState<T>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function change(next: T) {
    const previous = value
    setValue(next)
    setError(null)
    start(async () => {
      try {
        const res = await save(next)
        if (!res.ok) {
          setValue(previous)
          setError(res.error ?? SAVE_FAILED)
        }
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

/**
 * Which team the person plays for.
 *
 * Unlike YearGroupSelect this renders for EVERY role, not just students — a
 * coach who plays (Joseph Barton) needs a team too, and having one is what
 * makes someone pickable for a match squad.
 */
export function TeamSelect({
  user, teams, className = '',
}: {
  user: UserListItem
  teams: Team[]
  className?: string
}) {
  const { value, change, error, pending } = useSavedSelect(user.team_id ?? '', next =>
    setUserTeam(user.id, next || null)
  )
  return (
    <>
      <select
        aria-label={`Team for ${user.name}`}
        value={value}
        disabled={pending}
        onChange={e => change(e.target.value)}
        className={`text-xs border rounded px-1 py-0.5 bg-white cursor-pointer disabled:opacity-60 ${className}`}
      >
        <option value="">No team</option>
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
