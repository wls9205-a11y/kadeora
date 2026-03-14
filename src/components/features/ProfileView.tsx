'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Settings, LogOut, Star, Flame, Crown,
  Calendar, Trophy, Edit3, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { cn, timeAgo, formatCount, GRADE_COLORS } from '@/lib/utils'
import { PostCard } from '@/components/features/PostCard'
import toast from 'react-hot-toast'
import type { Profile, GradeDefinition, PostWithAuthor } from '@/types/database'

interface ProfileViewProps {
  profile: Profile
  posts: PostWithAuthor[]
  attendance: { streak: number; total_days: number; last_date: string | null } | null
  grades: GradeDefinition[]
  isOwner: boolean
}

const TABS = [
  { id: 'posts', label: '게시글' },
  { id: 'grade', label: '등급' },
]

export function ProfileView({ profile, posts, attendance, grades, isOwner }: ProfileViewProps) {
  const [tab, setTab] = useState('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const { reset } = useAuthStore()
  const supabase = createClient()
  const router = useRouter()

  const gradeColor = GRADE_COLORS[profile.grade] ?? '#9CA3AF'
  const currentGrade = grades.find(g => g.grade === profile.grade)
  const nextGrade = grades.find(g => g.grade === profile.grade + 1)
  const progressPct = nextGrade
    ? Math.min(100, ((profile.influence_score - (currentGrade?.min_score ?? 0)) /
        (nextGrade.min_score - (currentGrade?.min_score ?? 0))) * 100)
    : 100

  async function handleSignOut() {
    await supabase.auth.signOut()
    reset()
    router.push('/')
    toast.success('로그아웃됐어요')
  }

  async function handleFollow() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('로그인이 필요해요'); return }

    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('followee_id', profile.id)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, followee_id: profile.id })
    }
    setIsFollowing(!isFollowing)
  }

  async function handleCheckIn() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.rpc('check_in_attendance', { p_user_id: user.id })
    if (error) {
      toast.error('이미 출석했어요')
    } else if (data?.[0]) {
      const { streak, points_awarded, is_bonus } = data[0]
      toast.success(`출석 완료! 🎉 ${streak}일 연속${is_bonus ? ` (+${points_awarded}P 보너스!)` : ''}`)
    }
  }

  return (
    <div className="min-h-screen pb-6">
      {/* 헤더 배경 */}
      <div className="h-28 bg-gradient-to-br from-brand/30 via-brand/10 to-transparent relative">
        {isOwner && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href="/profile/edit" className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <Settings size={18} className="text-white/70" />
            </Link>
            <button onClick={handleSignOut} className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <LogOut size={18} className="text-white/70" />
            </button>
          </div>
        )}
      </div>

      {/* 프로필 영역 */}
      <div className="px-4 -mt-12 mb-4">
        <div className="flex items-end justify-between mb-3">
          {/* 아바타 */}
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.nickname}
              width={72}
              height={72}
              className="rounded-2xl border-4 border-[#0F0F0F]"
            />
          ) : (
            <div
              className="w-[72px] h-[72px] rounded-2xl border-4 border-[#0F0F0F] flex items-center justify-center text-2xl font-black"
              style={{ backgroundColor: gradeColor + '30', color: gradeColor }}
            >
              {profile.nickname[0]}
            </div>
          )}

          {/* 액션 버튼 */}
          {!isOwner && (
            <button
              onClick={handleFollow}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-semibold transition-all',
                isFollowing
                  ? 'bg-white/10 text-white/60'
                  : 'bg-brand text-white active:scale-95'
              )}
            >
              {isFollowing ? '팔로잉' : '팔로우'}
            </button>
          )}
        </div>

        {/* 이름 + 등급 */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-white">{profile.nickname}</h1>
          {profile.is_premium && <Crown size={16} className="text-yellow-400" />}
          <span
            className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: gradeColor + '20', color: gradeColor }}
          >
            {currentGrade?.emoji} {profile.grade_title}
          </span>
        </div>

        {profile.bio && (
          <p className="text-[14px] text-white/50 mb-3 leading-relaxed">{profile.bio}</p>
        )}

        {/* 통계 */}
        <div className="flex gap-4 mb-4">
          {[
            { label: '게시글', value: formatCount(profile.posts_count) },
            { label: '팔로워', value: formatCount(profile.followers_count) },
            { label: '팔로잉', value: formatCount(profile.following_count) },
            { label: '포인트', value: formatCount(profile.points) },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[16px] font-bold text-white">{value}</p>
              <p className="text-[11px] text-white/30">{label}</p>
            </div>
          ))}
        </div>

        {/* 출석 카드 (본인) */}
        {isOwner && (
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-orange-400" />
                <span className="text-sm font-semibold text-white">출석 현황</span>
              </div>
              <button
                onClick={handleCheckIn}
                className="btn-brand py-1.5 px-3 text-xs"
              >
                오늘 출석
              </button>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xl font-bold text-white">{attendance?.streak ?? 0}일</p>
                <p className="text-[11px] text-white/30">연속 출석</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white">{attendance?.total_days ?? 0}일</p>
                <p className="text-[11px] text-white/30">누적 출석</p>
              </div>
            </div>
          </div>
        )}

        {/* 등급 진행도 */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">영향력 점수</span>
            <span className="text-sm font-bold" style={{ color: gradeColor }}>
              {profile.influence_score.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: gradeColor }}
            />
          </div>
          {nextGrade && (
            <p className="text-[11px] text-white/30 mt-1.5">
              다음 등급 {nextGrade.emoji} {nextGrade.title}까지{' '}
              <span style={{ color: gradeColor }}>
                {(nextGrade.min_score - profile.influence_score).toLocaleString()}점
              </span>
            </p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/[0.06] mb-0">
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

      {/* 게시글 탭 */}
      {tab === 'posts' && (
        <div className="divide-y divide-white/[0.04]">
          {posts.length > 0 ? (
            posts.map(post => <PostCard key={post.id} post={post} />)
          ) : (
            <div className="py-16 text-center text-white/30">
              <p className="text-3xl mb-3">✏️</p>
              <p className="text-sm">아직 작성한 글이 없어요</p>
            </div>
          )}
        </div>
      )}

      {/* 등급 탭 */}
      {tab === 'grade' && (
        <div className="px-4 py-4 space-y-2">
          {grades.map(g => {
            const isCurrent = g.grade === profile.grade
            const isPassed = g.grade < profile.grade
            const color = GRADE_COLORS[g.grade] ?? '#9CA3AF'

            return (
              <div
                key={g.grade}
                className={cn(
                  'card p-4 transition-all',
                  isCurrent && 'border border-brand/30 bg-brand/5'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{g.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: isPassed || isCurrent ? color : '#555' }}
                      >
                        {g.title}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-brand/20 text-brand px-1.5 py-0.5 rounded-full font-medium">
                          현재
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/30 mt-0.5">{g.description}</p>
                  </div>
                  <span className="text-[12px] text-white/30 font-mono">
                    {g.min_score.toLocaleString()}+
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
