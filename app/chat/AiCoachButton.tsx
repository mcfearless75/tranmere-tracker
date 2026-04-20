'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { getOrCreateBotRoom } from './actions'

export function AiCoachButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    const result = await getOrCreateBotRoom()
    setLoading(false)
    if (typeof result === 'string') {
      router.push(`/chat/${result}`)
    } else {
      alert(result.error)
    }
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className="flex items-center gap-3 w-full p-3 rounded-2xl border bg-gradient-to-r from-tranmere-blue/5 to-blue-50 border-tranmere-blue/20 hover:bg-tranmere-blue/10 active:scale-[0.99] transition-all disabled:opacity-60"
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center shrink-0">
        <Bot size={22} className="text-white" />
      </div>
      <div className="text-left">
        <p className="font-semibold text-tranmere-blue">AI Coach</p>
        <p className="text-xs text-muted-foreground">Training, nutrition, coursework help</p>
      </div>
      {loading && <span className="ml-auto text-xs text-muted-foreground">Opening…</span>}
    </button>
  )
}
