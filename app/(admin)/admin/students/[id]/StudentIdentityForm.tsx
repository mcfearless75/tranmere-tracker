'use client'

import { useState, useTransition } from 'react'
import { IdCard } from 'lucide-react'
import { updateUserName, updateUserYearGroup } from '@/app/(admin)/admin/users/userActions'
import { USER_NAME_MAX } from '@/lib/users/types'

/**
 * Name and year group, editable from the student's own page.
 *
 * Both were previously unreachable here: the name was a static heading with no
 * write path anywhere in the app, and year group — editable since 2026-09-21 —
 * only had a control in a column of the Users table, which is where staff were
 * told to look but not where they look. This is the page you land on from the
 * roster, so it carries both.
 *
 * Year group is students-only, matching updateUserYearGroup, which rejects it
 * for staff (the column defaults to 1 on every row and is meaningless there).
 */
export function StudentIdentityForm({
  userId,
  name,
  yearGroup,
  isStudent,
}: {
  userId: string
  name: string
  yearGroup: number | null
  isStudent: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [draftYear, setDraftYear] = useState<number>(yearGroup ?? 1)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trimmed = draftName.trim()
  // Mirrors the server's own checks so the button is disabled rather than the
  // save failing — the action still re-validates, this is only the nicety.
  const invalid = !trimmed || trimmed.length > USER_NAME_MAX

  function cancel() {
    setDraftName(name)
    setDraftYear(yearGroup ?? 1)
    setError(null)
    setEditing(false)
  }

  function save() {
    setMsg(null)
    setError(null)
    start(async () => {
      try {
        // Each action reports its own refusal now, so a rejected rename no
        // longer lets the year group save and the form close on "Saved".
        if (trimmed !== name) {
          const res = await updateUserName(userId, trimmed)
          if (!res.ok) { setError(res.error ?? 'Save failed'); return }
        }
        if (isStudent && draftYear !== yearGroup) {
          const res = await updateUserYearGroup(userId, draftYear)
          if (!res.ok) { setError(res.error ?? 'Save failed'); return }
        }
        setEditing(false)
        setMsg('Saved')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  if (!editing) {
    return (
      <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-tranmere-blue flex items-center gap-1.5">
            <IdCard size={16} /> Name &amp; year group
          </h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-tranmere-blue underline underline-offset-2 hover:no-underline"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Name</p>
            <p className="text-sm font-medium break-words">{name}</p>
          </div>
          {isStudent && (
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Year group</p>
              <p className="text-sm font-medium">Year {yearGroup ?? 1}</p>
            </div>
          )}
        </div>

        {msg && <p className="text-xs text-green-600">{msg}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4">
      <h3 className="font-semibold text-tranmere-blue flex items-center gap-1.5">
        <IdCard size={16} /> Edit name &amp; year group
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Full name</span>
          <input
            type="text"
            value={draftName}
            maxLength={USER_NAME_MAX}
            onChange={e => setDraftName(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
          />
        </label>

        {isStudent && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Year group</span>
            <select
              value={draftYear}
              onChange={e => setDraftYear(Number(e.target.value))}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value={1}>Year 1</option>
              <option value={2}>Year 2</option>
            </select>
          </label>
        )}
      </div>

      {isStudent && (
        <p className="text-xs text-muted-foreground">
          Changing the year group also moves them into that year&apos;s group chat.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending || invalid}
          className="px-3 py-1.5 rounded-lg bg-tranmere-blue text-white text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={cancel}
          disabled={pending}
          className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
