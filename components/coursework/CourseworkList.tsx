import { GRADE_LABELS, GRADE_COLOURS, type GroupedUnit } from '@/lib/coursework/courseworkUtils'

type Props = { groups: GroupedUnit[] }

export function CourseworkList({ groups }: Props) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No coursework set yet.</p>
  }

  return (
    <div className="space-y-4">
      {groups.map(({ unit, assignments }) => (
        <div key={unit.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-tranmere-blue">{unit.unit_number} · {unit.unit_name}</p>
          {assignments.map(assignment => (
            <div key={assignment.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{assignment.title}</p>
                {assignment.grade ? (
                  <span className={`text-xs font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${GRADE_COLOURS[assignment.grade]}`}>
                    {GRADE_LABELS[assignment.grade]}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting result</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Due {new Date(assignment.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {assignment.grade_target && ` · Target: ${assignment.grade_target}`}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
