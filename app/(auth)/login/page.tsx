import { signIn } from './actions'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-tranmere-blue p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
            alt="Tranmere Rovers FC"
            width={80}
            height={80}
            priority
          />
          <h1 className="text-2xl font-bold text-tranmere-blue">Tranmere Tracker</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <form action={signIn} className="space-y-4">
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
              autoComplete="current-password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tranmere-blue"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-tranmere-blue text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors text-sm"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
