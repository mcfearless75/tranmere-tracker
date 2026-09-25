import type { PushCoverage } from '@/lib/notifications/pushCoverage'

/**
 * Staff dashboard card: how many people will actually get a notification
 * when a message or broadcast goes out, and who to chase.
 */
export function PushCoverageCard({ coverage }: { coverage: PushCoverage }) {
  const { total, reachable, unreachable } = coverage
  if (total === 0) return null
  const pct = Math.round((reachable / total) * 100)
  const allOn = unreachable.length === 0

  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${allOn ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-sm text-tranmere-blue">🔔 Notifications switched on</h2>
        <span className="text-sm font-bold text-tranmere-blue">{reachable}/{total} ({pct}%)</span>
      </div>
      {allOn ? (
        <p className="text-xs text-green-700">Everyone will get alerts for messages and broadcasts.</p>
      ) : (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {unreachable.length} won&apos;t get alerts — tap to see who to chase
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {unreachable.map(u => (
              <li key={u.id} className="truncate">
                {u.name ?? 'Unnamed'}
                {u.role !== 'student' && <span className="text-muted-foreground"> · {u.role}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
