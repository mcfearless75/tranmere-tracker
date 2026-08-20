'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/reportClientError'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, 'root')
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="rounded-2xl border bg-white p-8 max-w-sm w-full text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-tranmere-blue text-2xl">
          !
        </div>
        <h1 className="text-lg font-bold text-tranmere-blue mb-1">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-5">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-tranmere-blue px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
