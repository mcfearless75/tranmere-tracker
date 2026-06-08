import { Video } from 'lucide-react'

export function VeoComingSoon() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        <Video size={22} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-slate-800">
        Match clips coming soon
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500">
        Once the VEO connection is live, your match recordings and tagged
        highlights will appear here automatically. Nothing to do for now —
        check back after your next recorded fixture.
      </p>
    </div>
  )
}
