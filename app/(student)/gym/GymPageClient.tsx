'use client'

import { useRouter } from 'next/navigation'
import { GymLogForm } from '@/components/gym/GymLogForm'

export function GymPageClient() {
  const router = useRouter()
  return <GymLogForm onLogged={() => router.refresh()} />
}
