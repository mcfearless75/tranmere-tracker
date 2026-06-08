'use client'

import { UnitProgress } from '@/lib/academics/academicsUtils'

interface UnitProgressBarsProps {
  units: UnitProgress[]
}

export function UnitProgressBars({ units }: UnitProgressBarsProps) {
  if (units.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No units to display
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {units.map((unit) => (
        <div key={unit.unitTitle} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800 leading-snug pr-4">
              {unit.unitTitle}
            </p>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {unit.submitted}/{unit.total} submitted
            </p>
          </div>

          <div className="relative h-2.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-tranmere-blue transition-all duration-500"
              style={{ width: `${unit.pct}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground text-right">{unit.pct}%</p>
        </div>
      ))}
    </div>
  )
}
