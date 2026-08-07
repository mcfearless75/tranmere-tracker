'use client'

export default function ChatError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="rounded-2xl border bg-white p-6 max-w-sm w-full text-center">
        <h2 className="text-base font-bold text-tranmere-blue mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-4">
          The chat hit an unexpected error. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-tranmere-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Try again
          </button>
          <a href="/chat" className="text-sm text-tranmere-blue underline">
            Back to chats
          </a>
        </div>
      </div>
    </div>
  )
}
