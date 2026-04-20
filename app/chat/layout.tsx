import { BottomNav } from '@/components/layout/BottomNav'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
