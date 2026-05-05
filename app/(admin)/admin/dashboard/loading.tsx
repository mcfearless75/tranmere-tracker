export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded" />
            <div className="h-8 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-4 bg-gray-100 rounded w-full" />
        ))}
      </div>
    </div>
  )
}
