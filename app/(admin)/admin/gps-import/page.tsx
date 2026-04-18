import { GpsImportForm } from './GpsImportForm'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function GpsImportPage() {
  const supabase = createAdminClient()
  const { data: sessions } = await supabase
    .from('gps_sessions')
    .select('id, session_date, session_label, source, total_distance_m, max_speed_kmh, sprint_count, users:player_id (name)')
    .order('session_date', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-tranmere-blue">GPS Import — STATSports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export a session CSV from the STATSports app or web platform, then upload it here.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1">
        <p className="font-semibold text-blue-800">How to export from STATSports</p>
        <ol className="list-decimal list-inside text-blue-700 space-y-0.5">
          <li>Open the STATSports app or web platform</li>
          <li>Go to the session you want → tap Export / Download</li>
          <li>Choose <strong>CSV</strong> format (not PDF)</li>
          <li>Make sure player names match exactly what&apos;s in this app</li>
          <li>Upload the CSV below</li>
        </ol>
      </div>

      <GpsImportForm />

      {sessions && sessions.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Recent Imports</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Session</th>
                  <th className="px-3 py-2 text-right">Distance</th>
                  <th className="px-3 py-2 text-right">Top Speed</th>
                  <th className="px-3 py-2 text-right">Sprints</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium">{s.users?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(s.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-3 py-2">{s.session_label ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {s.total_distance_m ? `${(s.total_distance_m / 1000).toFixed(2)} km` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.max_speed_kmh ? `${s.max_speed_kmh} km/h` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{s.sprint_count ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
