'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { describeSignInError } from '@/lib/auth/signInError'

const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function StaffPinForm({ next }: { next?: string }) {
  const router = useRouter()
  // Reject '//evil.com' (protocol-relative) as well as absolute URLs — same
  // guard as the email/password and Google sign-in paths.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const [username, setUsername] = useState('')
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
    if (!username.trim()) { setError('Enter your username'); return }
    if (pin.length < 5) { setError('PIN too short'); return }
    setLoading(true)
    setError('')
    const internalEmail = `${username.trim().toLowerCase()}@tranmeretracker.internal`
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: pin,
    })
    if (err) {
      const info = describeSignInError(err, 'Incorrect username or PIN')
      setError(info.message)
      if (!info.retryable) setPin('')
      setLoading(false)
    } else {
      // If they arrived via an NFC tap (or any protected link) while signed
      // out, land them back there so the action they came to do — e.g.
      // check in — actually completes. Otherwise root page redirects to
      // /admin/* or /dashboard based on role.
      router.push(safeNext)
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        className="text-center text-base"
        autoCapitalize="none"
        autoCorrect="off"
      />

      {/* PIN dots */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
              i < pin.length ? 'bg-tranmere-blue border-tranmere-blue' : 'border-gray-300'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-center text-red-600 text-sm">{error}</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((d, i) => (
          <button
            key={i}
            onClick={() => press(d === '⌫' ? '⌫' : d)}
            disabled={loading}
            className={`h-13 py-3 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
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
        disabled={!username || pin.length < 5 || loading}
        className="w-full bg-tranmere-blue hover:bg-blue-900 text-white h-12 text-base"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>
    </div>
  )
}
