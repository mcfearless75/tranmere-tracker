import Image from 'next/image'
import Link from 'next/link'
import { LoginForm } from './LoginForm'
import { ShieldCheck, User } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-tranmere-blue p-4">
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

        <LoginForm />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-muted-foreground">or use a PIN</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/admin-login"
            className="flex flex-col items-center gap-1 rounded-xl border-2 border-tranmere-blue bg-tranmere-blue text-white p-3 text-sm font-semibold hover:bg-blue-900 transition-colors"
          >
            <ShieldCheck size={18} />
            Admin PIN
          </Link>
          <Link
            href="/staff-login"
            className="flex flex-col items-center gap-1 rounded-xl border-2 border-tranmere-blue text-tranmere-blue p-3 text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            <User size={18} />
            Staff / Student
          </Link>
        </div>
      </div>
    </div>
  )
}
