'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { UserRow } from './UserRow'
import { UserCard } from './UserCard'
import type { UserListItem, Course } from './UserFields'

/**
 * The Users list, with search.
 *
 * Filtering is client-side: the page already fetches every active user in one
 * query to render the list, so there is nothing to gain from a round trip and
 * results update as you type.
 *
 * Matches name and email only — deliberately NOT role. Matching role would
 * mean typing "Stu" to find Stuart also surfaces every student, which is
 * worse than no filter at all.
 */
export function UsersList({ users, courses }: { users: UserListItem[]; courses: Course[] }) {
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return users
    return users.filter(u =>
      u.name?.toLowerCase().includes(needle) || u.email?.toLowerCase().includes(needle)
    )
  }, [users, needle])

  const searching = needle.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            aria-label="Search users by name or email"
            placeholder="Search by name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full border rounded-lg pl-9 pr-10 py-2 text-sm bg-white"
          />
          {searching && (
            /* h-8 w-8 rather than the icon's own 14px: a p-1 button gives a
               22px tap target, under the 24px minimum and fiddly with a thumb.
               The input is 38px tall, so 32px is the most that fits inside
               it. */
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-gray-100"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {searching && (
        <p className="text-xs text-muted-foreground" role="status">
          Showing {filtered.length} of {users.length}
        </p>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Phone: stacked cards. The table below is min-w-[600px] inside a
            horizontal scroller, which pushed the Role/Year/Course controls
            off-screen on a phone — reachable only by scrolling a table
            sideways, which nobody does. Same controls, same actions, both
            layouts (see UserFields). */}
        <div className="sm:hidden">
          {filtered.map(u => (
            <UserCard key={u.id} user={u} courses={courses} />
          ))}
          {!filtered.length && (
            <p className="px-4 py-6 text-center text-muted-foreground">{emptyMessage(searching, query)}</p>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Role', 'Year', 'Course', 'Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserRow key={u.id} user={u} courses={courses} />
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {emptyMessage(searching, query)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/**
 * "No users yet" and "nothing matched your search" are different situations
 * and a single message for both is misleading — an admin who has just typed a
 * typo should not be told the roster is empty.
 */
function emptyMessage(searching: boolean, query: string) {
  return searching ? `No users match “${query.trim()}”.` : 'No users yet.'
}
