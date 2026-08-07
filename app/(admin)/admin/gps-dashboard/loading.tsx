export default function GpsDashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-56 bg-gray-200 rounded" />
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl bg-gray-200 p-4 h-24" />
        ))}
      </div>
      {/* Leaderboard rows */}
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="h-4 flex-1 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
