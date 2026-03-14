import { BottomNav } from '@/components/layout/BottomNav'
import { TopBar } from '@/components/layout/TopBar'
import { MegaphoneBanner } from '@/components/features/MegaphoneBanner'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-dvh max-w-mobile mx-auto bg-[#0F0F0F]">
      {/* 상단 바 */}
      <TopBar />

      {/* 메가폰 배너 */}
      <MegaphoneBanner />

      {/* 메인 콘텐츠 */}
      <main className="pt-14 pb-nav page-enter">
        {children}
      </main>

      {/* 하단 네비 */}
      <BottomNav />
    </div>
  )
}
