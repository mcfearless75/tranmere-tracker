'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AttendanceBar } from './AttendanceBar'
import { DrillDownModal } from './DrillDownModal'
import type { AttendanceWeek, AttendanceDrillDay } from '@/lib/charts/attendanceUtils'

interface StudentChartsProps {
  attendanceWeeks: AttendanceWeek[]
  attendanceDrill: Record<string, AttendanceDrillDay[]>
}

export function StudentCharts({ attendanceWeeks, attendanceDrill }: StudentChartsProps) {
  const [attendanceModal, setAttendanceModal] = useState<AttendanceWeek | null>(null)

  return (
    <>
      {/* ═══════════ ATTENDANCE BAR CHART ═══════════ */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Attendance — by week
          </p>
          <p className="text-[10px] text-muted-foreground">tap a bar for details</p>
        </div>
        <AttendanceBar
          data={attendanceWeeks}
          onBarClick={week => setAttendanceModal(week)}
        />
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />≥90%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />75–89%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />&lt;75%</span>
        </div>
      </div>

      {/* ═══════════ ATTENDANCE DRILL-DOWN MODAL ═══════════ */}
      <DrillDownModal
        isOpen={attendanceModal !== null}
        onClose={() => setAttendanceModal(null)}
        title={`Week of ${attendanceModal?.week ?? ''} — ${attendanceModal?.pct ?? 0}%`}
      >
        {attendanceModal && (() => {
          const days = attendanceDrill[attendanceModal.week] ?? []
          return (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                {attendanceModal.attended} of {attendanceModal.scheduled} days attended
              </p>
              {days.length === 0 ? (
                <p className="text-sm text-muted-foreground">No session breakdown available.</p>
              ) : (
                days.map(day => (
                  <div key={day.date} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`text-lg leading-none ${day.attended ? 'text-emerald-500' : 'text-red-400'}`}>
                      {day.attended ? '✓' : '✗'}
                    </span>
                    <span className="text-sm text-gray-700">{day.label}</span>
                    <span className={`ml-auto text-xs font-medium ${day.attended ? 'text-emerald-600' : 'text-red-500'}`}>
                      {day.attended ? 'Present' : 'Absent'}
                    </span>
                  </div>
                ))
              )}
              <Link
                href="/attendance"
                className="block text-center text-xs font-semibold text-tranmere-blue underline underline-offset-2 mt-3"
              >
                View full attendance →
              </Link>
            </div>
          )
        })()}
      </DrillDownModal>
    </>
  )
}
