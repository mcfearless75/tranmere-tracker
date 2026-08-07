export default function StudentsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Profile header */}
      <div className="flex items-center gap-3 py-2">
        <div className="w-14 h-14 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      </div>
      {/* Detail cards */}
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-2xl border bg-white p-4 space-y-2">
          <div className="h-3 w-32 bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-2/3 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}
