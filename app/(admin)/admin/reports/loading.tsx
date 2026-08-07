export default function ReportsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-44 bg-gray-200 rounded" />
      {/* Report cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl border bg-white p-5 space-y-2">
            <div className="h-4 w-36 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div className="h-48 w-full bg-gray-100 rounded" />
      </div>
    </div>
  )
}
