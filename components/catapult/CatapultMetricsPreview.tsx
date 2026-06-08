import { Activity, Gauge, HeartPulse, Route, Timer, Zap } from 'lucide-react'

interface CatapultMetric {
  label: string
  description: string
  icon: React.ReactNode
}

const CATAPULT_METRICS: CatapultMetric[] = [
  { label: 'Total Distance', description: 'Metres covered per session, split by speed zone.', icon: <Route size={16} /> },
  { label: 'Top Speed', description: 'Peak sprint velocity captured by the GPS pod.', icon: <Zap size={16} /> },
  { label: 'Player Load', description: 'Accumulated mechanical load across the session.', icon: <Activity size={16} /> },
  { label: 'High-Speed Running', description: 'Distance run above the high-intensity threshold.', icon: <Gauge size={16} /> },
  { label: 'Accelerations', description: 'Count of explosive accel and decel efforts.', icon: <Timer size={16} /> },
  { label: 'Heart Rate', description: 'Live and average HR where a strap is paired.', icon: <HeartPulse size={16} /> },
]

/**
 * Read-only preview of the Catapult metrics that will sync once the
 * vendor API credentials are in place. Each card is shown in a disabled
 * "coming soon" state so the layout matches the live performance page.
 */
export function CatapultMetricsPreview() {
  return (
    <ul className="grid grid-cols-2 gap-3" aria-label="Catapult metrics coming soon">
      {CATAPULT_METRICS.map(({ label, description, icon }) => (
        <li
          key={label}
          className="relative rounded-2xl border border-slate-200 bg-white p-3"
        >
          <span className="absolute right-2 top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Soon
          </span>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="text-teal-600">{icon}</span>
            {label}
          </div>
          <p className="text-xs leading-relaxed text-slate-400">{description}</p>
        </li>
      ))}
    </ul>
  )
}
