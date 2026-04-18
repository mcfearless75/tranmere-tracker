'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { getStatusLabel, getStatusColor, type SubmissionStatus } from '@/lib/utils'

type Props = {
  assignmentId: string
  studentId: string
  title: string
  unitName: string
  dueDate: string
  gradeTarget: string | null
  status: SubmissionStatus
  grade: string | null
  feedback: string | null
}

export function AssignmentCard({
  assignmentId,
  studentId,
  title,
  unitName,
  dueDate,
  gradeTarget,
  status,
  grade,
  feedback,
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const daysUntil = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)

  async function updateStatus(newStatus: SubmissionStatus) {
    setSaving(true)
    await supabase.from('submissions').upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      status: newStatus,
      submitted_at: newStatus === 'submitted' ? new Date().toISOString() : null,
    }, { onConflict: 'assignment_id,student_id' })
    setCurrentStatus(newStatus)
    setSaving(false)
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{unitName}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${getStatusColor(currentStatus)}`}>
            {getStatusLabel(currentStatus)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>Due: {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {daysUntil >= 0 && daysUntil <= 7 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {daysUntil === 0 ? 'Due today!' : `${daysUntil}d left`}
            </Badge>
          )}
          {gradeTarget && <span>Target: {gradeTarget}</span>}
        </div>

        {grade && (
          <p className="text-xs font-medium text-green-700">Grade: {grade}</p>
        )}
        {feedback && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-gray-200 pl-2">&quot;{feedback}&quot;</p>
        )}

        {currentStatus !== 'graded' && (
          <select
            value={currentStatus}
            disabled={saving}
            onChange={e => updateStatus(e.target.value as SubmissionStatus)}
            className="w-full text-xs border rounded-lg px-2 py-2 mt-1 bg-white disabled:opacity-60"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
          </select>
        )}
      </CardContent>
    </Card>
  )
}
