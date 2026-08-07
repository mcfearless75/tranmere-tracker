export default function ParentDashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>
      {/* Attendance / summary cards */}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border bg-white p-4 space-y-2">
          <div className="h-3 w-40 bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-2 w-full bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  )
}
