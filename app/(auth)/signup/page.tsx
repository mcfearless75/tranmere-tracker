import Image from 'next/image'
import { SignupForm } from './SignupForm'

export default function SignupPage() {
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
          <p className="text-sm text-muted-foreground">Create your account</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
