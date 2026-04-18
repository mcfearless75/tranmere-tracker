import { createClient as createServiceClient } from '@supabase/supabase-js'
import { SetupForm } from './SetupForm'
import { redirect } from 'next/navigation'
import Image from 'next/image'

export default async function SetupPage() {
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Lock setup if an admin already exists
  const { data: admins } = await adminClient
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (admins && admins.length > 0) redirect('/login')

  const requiresPin = !!process.env.SETUP_PIN

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
          <h1 className="text-2xl font-bold text-tranmere-blue">First-Time Setup</h1>
          <p className="text-sm text-muted-foreground text-center">
            Create the superuser account. This page locks once an admin exists.
          </p>
        </div>
        <SetupForm requiresPin={requiresPin} />
      </div>
    </div>
  )
}
