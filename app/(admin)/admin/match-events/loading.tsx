export default function MatchEventsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-gray-200 rounded" />
        <div className="h-9 w-28 bg-gray-200 rounded-lg" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
          </div>
          <div className="h-20 bg-gray-50 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
