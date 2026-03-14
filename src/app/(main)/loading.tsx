import { FeedSkeleton } from '@/components/ui/Skeleton'

export default function FeedLoading() {
  return (
    <div className="min-h-screen">
      {/* 티커 플레이스홀더 */}
      <div className="h-8 bg-[#111111] animate-pulse" />
      {/* 지역 선택 플레이스홀더 */}
      <div className="h-10 border-b border-white/[0.04]" />
      {/* 탭 플레이스홀더 */}
      <div className="h-12 border-b border-white/[0.06]" />
      <FeedSkeleton />
    </div>
  )
}
