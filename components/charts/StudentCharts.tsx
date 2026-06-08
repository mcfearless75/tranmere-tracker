'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AttendanceBar } from './AttendanceBar'
import { AcademicPie } from './AcademicPie'
import { DrillDownModal } from './DrillDownModal'
import type { AttendanceWeek, AttendanceDrillDay } from '@/lib/charts/attendanceUtils'
import type { AcademicCounts } from '@/lib/charts/academicUtils'

type SliceKey = 'complete' | 'inProgress' | 'notStarted'

const SLICE_META: Record<SliceKey, { label: string; description: string; color: string }> = {
  complete:   { label: 'Complete',    description: 'Submitted or graded', color: 'text-emerald-700' },
  inProgress: { label: 'In Progress', description: 'Started but not submitted', color: 'text-amber-700' },
  notStarted: { label: 'Not Started', description: 'Not yet begun', color: 'text-gray-600' },
}

interface StudentChartsProps {
  attendanceWeeks: AttendanceWeek[]
  attendanceDrill: Record<string, AttendanceDrillDay[]>
  academicCounts: AcademicCounts
}

export function StudentCharts({ attendanceWeeks, attendanceDrill, academicCounts }: StudentChartsProps) {
  const [attendanceModal, setAttendanceModal] = useState<AttendanceWeek | null>(null)
  const [academicModal, setAcademicModal] = useState<SliceKey | null>(null)

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

      {/* ═══════════ ACADEMIC PIE CHART ═══════════ */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Academic progress
          </p>
          <p className="text-[10px] text-muted-foreground">tap a slice for details</p>
        </div>
        <AcademicPie
          data={academicCounts}
          onSliceClick={key => setAcademicModal(key)}
        />
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

      {/* ═══════════ ACADEMIC DRILL-DOWN MODAL ═══════════ */}
      <DrillDownModal
        isOpen={academicModal !== null}
        onClose={() => setAcademicModal(null)}
        title={academicModal ? `${SLICE_META[academicModal].label} units` : ''}
      >
        {academicModal && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {SLICE_META[academicModal].description}
            </p>
            <div className={`text-3xl font-bold ${SLICE_META[academicModal].color}`}>
              {academicCounts[academicModal]}
            </div>
            <p className="text-xs text-muted-foreground">
              {academicModal === 'notStarted' && academicCounts.notStarted > 0
                ? 'These units need attention — get started today.'
                : academicModal === 'inProgress'
                ? 'Keep going — submit when ready.'
                : 'Great work on these units.'}
            </p>
            <Link
              href="/coursework"
              className="block w-full text-center text-sm font-semibold bg-tranmere-blue text-white rounded-xl py-2.5 mt-2"
            >
              View all in Coursework →
            </Link>
          </div>
        )}
      </DrillDownModal>
    </>
  )
}
