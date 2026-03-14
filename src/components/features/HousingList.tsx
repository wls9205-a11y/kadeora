'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Calendar, MapPin, ExternalLink, PenSquare, Flame } from 'lucide-react'
import { PostCard } from '@/components/features/PostCard'
import { cn } from '@/lib/utils'
import type { AptSubscription, PostWithAuthor } from '@/types/database'

interface SubscriptionSchedule {
  id: number; apt_name: string; location: string; city: string | null
  district: string | null; supply_count: number | null
  apply_start: string | null; apply_end: string | null
  announce_date: string | null; move_in_date: string | null
  price_range: string | null; is_hot: boolean; source_url: string | null
}

interface HousingListProps {
  schedules: SubscriptionSchedule[]
  apts: AptSubscription[]
  posts: PostWithAuthor[]
  currentRegion: string
  query: string
}

const TABS = [
  { id: 'schedule', label: '청약 일정' },
  { id: 'discuss', label: '청약 토론' },
]

const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충청', '전라', '경상', '제주']

export function HousingList({ schedules, apts, posts, currentRegion, query }: HousingListProps) {
  const [tab, setTab] = useState('schedule')
  const [search, setSearch] = useState(query)
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleRegion(region: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (region !== '전체') params.set('region', region)
    else params.delete('region')
    router.push(`/housing?${params.toString()}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set('q', search)
    else params.delete('q')
    router.push(`/housing?${params.toString()}`)
  }

  function dday(dateStr: string | null): string {
    if (!dateStr) return '-'
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    if (diff < 0) return '마감'
    if (diff === 0) return 'D-DAY'
    return `D-${diff}`
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-white mb-3">청약 정보</h1>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="단지명 검색"
            className="input-base pl-9 text-sm h-10"
          />
        </form>

        {/* 지역 필터 */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => handleRegion(r)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                (r === '전체' ? !currentRegion : currentRegion === r)
                  ? 'bg-brand text-white'
                  : 'bg-white/[0.06] text-white/50 hover:bg-white/10'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-all',
              tab === t.id ? 'border-brand text-white' : 'border-transparent text-white/40'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 청약 일정 탭 */}
      {tab === 'schedule' && (
        <div className="divide-y divide-white/[0.04]">
          {schedules.length === 0 ? (
            <div className="py-16 text-center text-white/30">
              <p className="text-3xl mb-3">🏠</p>
              <p className="text-sm">현재 청약 일정이 없어요</p>
            </div>
          ) : (
            schedules.map(s => {
              const ddayVal = dday(s.apply_end)
              const isUrgent = ddayVal !== '마감' && ddayVal !== '-' &&
                parseInt(ddayVal.replace('D-', '') || '0') <= 7

              return (
                <div key={s.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {s.is_hot && (
                          <span className="flex items-center gap-0.5 text-[10px] text-orange-400 font-medium">
                            <Flame size={10} />HOT
                          </span>
                        )}
                        <h3 className="text-[15px] font-semibold text-white truncate">{s.apt_name}</h3>
                      </div>

                      <div className="flex items-center gap-1.5 text-[12px] text-white/40 mb-2">
                        <MapPin size={11} />
                        <span>{s.location}</span>
                        {s.supply_count && (
                          <><span className="text-white/20">·</span><span>{s.supply_count.toLocaleString()}세대</span></>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[12px] text-white/50">
                        <Calendar size={11} className="text-white/30" />
                        <span>
                          {s.apply_start ?? '-'} ~ {s.apply_end ?? '-'}
                        </span>
                      </div>

                      {s.price_range && (
                        <p className="mt-1 text-[12px] text-white/40">{s.price_range}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      <span className={cn(
                        'text-sm font-bold px-2.5 py-1 rounded-lg',
                        ddayVal === '마감' ? 'bg-white/10 text-white/30' :
                        ddayVal === 'D-DAY' ? 'bg-brand text-white' :
                        isUrgent ? 'bg-orange-500/20 text-orange-400' :
                        'bg-white/[0.08] text-white/60'
                      )}>
                        {ddayVal}
                      </span>
                      {s.source_url && (
                        <a
                          href={s.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-brand/60 hover:text-brand flex items-center gap-0.5"
                        >
                          공고 <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 청약 토론 탭 */}
      {tab === 'discuss' && (
        <div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-white/50">{posts.length}개의 글</span>
            <Link href="/post/write?category=housing" className="flex items-center gap-1.5 text-sm text-brand">
              <PenSquare size={14} />글쓰기
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {posts.length > 0 ? (
              posts.map(post => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="py-16 text-center text-white/30">
                <p className="text-3xl mb-3">💬</p>
                <p className="text-sm">첫 청약 토론 글을 써보세요</p>
                <Link href="/post/write?category=housing" className="mt-3 inline-block text-sm text-brand">
                  글 작성하기 →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
