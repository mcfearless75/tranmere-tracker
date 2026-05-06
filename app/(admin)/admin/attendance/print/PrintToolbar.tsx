'use client'

export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print flex items-center justify-between border-b pb-3 mb-4">
      <a href={backHref} className="text-sm text-blue-700 underline">← Back to attendance</a>
      <button
        onClick={() => window.print()}
        className="bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-800"
      >
        Print / Save as PDF
      </button>
    </div>
  )
}
