'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState, useMemo } from 'react'
import { signUp } from './actions'

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-400' }
  if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

function makeMathChallenge() {
  const a = Math.floor(Math.random() * 9) + 1
  const b = Math.floor(Math.random() * 9) + 1
  return { question: `${a} + ${b}`, answer: String(a + b) }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-tranmere-blue text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? 'Creating account…' : 'Create Account'}
    </button>
  )
}

export function SignupForm() {
  const [state, action] = useFormState(signUp, null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const strength = getPasswordStrength(password)
  const mismatch = confirm.length > 0 && password !== confirm
  const math = useMemo(() => makeMathChallenge(), [])

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {state.error}
        </div>
      )}

      {/* Honeypot — hidden from real users */}
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">Full Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="e.g. Jamie Carragher"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
        />
        {password.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= strength.score ? strength.color : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium ${
              strength.score <= 1 ? 'text-red-600' :
              strength.score <= 3 ? 'text-amber-600' :
              strength.score === 4 ? 'text-blue-600' : 'text-green-600'
            }`}>{strength.label}</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirm" className="text-sm font-medium">Confirm Password</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue ${
            mismatch ? 'border-red-400' : ''
          }`}
        />
        {mismatch && <p className="text-xs text-red-600">Passwords do not match</p>}
      </div>

      {/* Human check */}
      <div className="space-y-1 bg-gray-50 rounded-lg p-3 border">
        <p className="text-xs font-medium text-muted-foreground">Human check</p>
        <label htmlFor="math_answer" className="text-sm">
          What is <span className="font-bold text-tranmere-blue">{math.question}</span>?
        </label>
        <input type="hidden" name="math_expected" value={math.answer} />
        <input
          id="math_answer"
          name="math_answer"
          type="number"
          required
          inputMode="numeric"
          placeholder="Your answer"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue mt-1"
        />
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className="text-tranmere-blue font-medium underline underline-offset-2">
          Sign in
        </a>
      </p>
    </form>
  )
}
