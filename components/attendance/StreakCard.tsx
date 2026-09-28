import { Flame } from 'lucide-react'
import type { Streak } from '@/lib/attendance/streak'

export function streakMessage({ current, best, todayDone }: Streak): string {
  if (todayDone) return current >= 5 ? `${current} days straight. Keep it rolling tomorrow.` : 'Today’s in the bag. Same again tomorrow.'
  if (current > 0) return `Scan in and out today to make it ${current + 1}.`
  if (best > 0) return `Your best is ${best}. Scan in and out today to start again.`
  return 'Scan in and out today to start your streak.'
}

/** Compact streak card for the student dashboard and planner. */
export function StreakCard({ streak }: { streak: Streak }) {
  const lit = streak.current > 0
  return (
    <div
      data-testid="streak-card"
      className={`rounded-2xl border p-4 flex items-center gap-4 ${
        lit ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50' : 'border-border bg-white'
      }`}
    >
      <div className={`shrink-0 w-14 h-14 rounded-full flex flex-col items-center justify-center ${lit ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
        <Flame size={20} className={lit ? 'fill-white/30' : ''} />
        <span className="text-lg font-extrabold leading-none">{streak.current}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${lit ? 'text-orange-700' : 'text-tranmere-blue'}`}>
          {streak.current === 1 ? '1-day streak' : `${streak.current}-day streak`}
        </p>
        <p className="text-xs text-muted-foreground">{streakMessage(streak)}</p>
        {streak.best > streak.current && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Best: {streak.best}</p>
        )}
      </div>
    </div>
  )
}
