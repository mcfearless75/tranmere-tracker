'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const SUPERUSER_EMAIL = 'superuser@tranmeretracker.internal'

const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function AdminPinForm() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function press(d: string) {
    if (d === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (d === '') return
    if (pin.length >= 6) return
    setPin(p => p + d)
  }

  async function submit() {
    if (pin.length < 5) { setError('PIN too short'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: SUPERUSER_EMAIL,
      password: pin,
    })
    if (err) {
      setError('Incorrect PIN')
      setPin('')
      setLoading(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <div className="space-y-5">
      {/* PIN dots */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length ? 'bg-tranmere-blue border-tranmere-blue' : 'border-gray-300'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-center text-red-600 text-sm">{error}</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((d, i) => (
          <button
            key={i}
            onClick={() => d === '⌫' ? press('⌫') : press(d)}
            disabled={loading}
            className={`h-14 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
              d === '' ? 'invisible' :
              d === '⌫' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
              'bg-gray-50 text-tranmere-blue hover:bg-blue-50 border border-gray-200'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <Button
        onClick={submit}
        disabled={pin.length < 5 || loading}
        className="w-full bg-tranmere-blue hover:bg-blue-900 text-white h-12 text-base"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>
    </div>
  )
}
