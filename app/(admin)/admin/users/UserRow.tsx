'use client'
import { useTransition } from 'react'
import { updateUserRole, updateUserCourse } from './userActions'

interface Course { id: string; name: string }
interface Props {
  user: { id: string; name: string; email: string; role: string; course_id: string | null; created_at: string; courses: { name: string } | null }
  courses: Course[]
}

const roleColor: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  coach: 'bg-green-100 text-green-700',
  teacher: 'bg-amber-100 text-amber-700',
  admin: 'bg-purple-100 text-purple-700',
}

export function UserRow({ user, courses }: Props) {
  const [, startTransition] = useTransition()

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3 font-medium">{user.name}</td>
      <td className="px-4 py-3 text-muted-foreground text-sm">{user.email}</td>
      <td className="px-4 py-3">
        <select
          defaultValue={user.role}
          onChange={e => startTransition(() => updateUserRole(user.id, e.target.value))}
          className={`text-xs px-2 py-0.5 rounded-full font-medium border-none outline-none cursor-pointer ${roleColor[user.role] ?? 'bg-gray-100'}`}
        >
          {['student', 'coach', 'teacher', 'admin'].map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          defaultValue={user.course_id ?? ''}
          onChange={e => startTransition(() => updateUserCourse(user.id, e.target.value))}
          className="text-xs text-muted-foreground border rounded px-1 py-0.5 bg-white cursor-pointer max-w-[180px]"
        >
          <option value="">No course</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(user.created_at).toLocaleDateString('en-GB')}
      </td>
    </tr>
  )
}
