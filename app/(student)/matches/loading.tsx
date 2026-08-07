export default function MatchesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded" />
      {/* Match cards */}
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-2xl border bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}
