import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CohortReportClient } from './CohortReportClient'

export const dynamic = 'force-dynamic'

export default function AiCohortReportPage() {
  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Reports
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">AI Cohort Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Claude-written executive summary across attendance, GPS, wellbeing and match form for the last 30 days.
        </p>
      </div>
      <CohortReportClient />
    </div>
  )
}
