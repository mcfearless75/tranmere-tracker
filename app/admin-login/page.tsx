import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminPinForm } from './AdminPinForm'

export default function AdminLoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-tranmere-blue p-4">
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
            alt="Tranmere Rovers FC"
            width={72}
            height={72}
            priority
          />
          <h1 className="text-xl font-bold text-tranmere-blue">Admin Access</h1>
          <p className="text-sm text-muted-foreground text-center">Enter your PIN to continue</p>
        </div>
        <AdminPinForm />
        <Link href="/login" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-tranmere-blue transition-colors pt-2">
          <ArrowLeft size={12} /> Back to main login
        </Link>
      </div>
    </div>
  )
}
