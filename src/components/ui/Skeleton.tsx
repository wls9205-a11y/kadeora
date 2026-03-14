import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-white/[0.06]', className)} />
  )
}

// 게시글 카드 스켈레톤
export function PostCardSkeleton() {
  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-3 ml-auto">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>
  )
}

// 피드 스켈레톤
export function FeedSkeleton() {
  return (
    <div className="divide-y divide-white/[0.04]">
      {Array.from({ length: 6 }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  )
}

// 프로필 스켈레톤
export function ProfileSkeleton() {
  return (
    <div className="px-4 pt-4">
      <div className="flex items-end gap-3 mb-4">
        <Skeleton className="w-[72px] h-[72px] rounded-2xl" />
        <div className="flex-1 space-y-2 pb-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="flex gap-4 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center space-y-1">
            <Skeleton className="h-5 w-10 mx-auto" />
            <Skeleton className="h-3 w-8 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
