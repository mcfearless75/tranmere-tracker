export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>
      {/* Cards */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border p-4 space-y-2">
          <div className="h-3 w-32 bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-3/4 bg-gray-100 rounded" />
        </div>
      ))}
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded" />
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}
