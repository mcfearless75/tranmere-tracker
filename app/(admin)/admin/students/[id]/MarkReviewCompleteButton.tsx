'use client'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function MarkReviewCompleteButton({ reviewId }: { reviewId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    await fetch(`/api/reviews/${reviewId}/complete`, { method: 'PATCH' })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
    >
      <CheckCircle2 size={11} />
      {loading ? 'Saving…' : 'Mark complete'}
    </button>
  )
}
