'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'

export function PrintTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="no-print flex items-center justify-between px-6 py-3 bg-tranmere-blue text-white text-sm">
      <span className="font-medium">Learner Review — print or save as PDF</span>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 bg-white text-tranmere-blue font-semibold px-4 py-1.5 rounded-lg text-sm hover:bg-blue-50"
      >
        <Printer size={14} /> Print / Save PDF
      </button>
    </div>
  )
}
