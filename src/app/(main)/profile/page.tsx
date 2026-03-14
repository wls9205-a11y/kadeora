'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui'
import { PostCard } from '@/components/features'
import { GRADES, getGradeInfo } from '@/lib/utils'

// 임시 사용자 데이터
const MOCK_USER = {
  nickname: '투자의신',
  grade: 7,
  influence: 5200,
  isPremium: true,
  bio: '주식/부동산 10년차 투자자. 가치투자와 지역 분석을 좋아합니다.',
  postCount: 128,
  followerCount: 2400,
  followingCount: 89,
  points: 3450,
  consecutiveAttendance: 23,
  totalAttendance: 156,
}

const MOCK_USER_POSTS = [
  {
    id: '1',
    author_id: '1',
    category: 'stock' as const,
    title: '삼성전자 9만전자 가능할까요?',
    content: '반도체 사이클 회복기에 접어든 것 같은데 여러분 의견은?',
    tags: ['삼성전자', '반도체'],
    is_anonymous: false,
    is_hot: true,
    is_premium: false,
    likes_count: 342,
    comments_count: 89,
    views_count: 2841,
    region: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author: { id: '1', nickname: '투자의신', grade: 7, influence: 5200, avatar_url: null, bio: null, region: null, interests: null, is_premium: false, points: 0, consecutive_attendance: 0, total_attendance: 0, follower_count: 0, following_count: 0, post_count: 0, created_at: '', updated_at: '' },
  },
]

export default function ProfilePage() {
  const { C } = useTheme()
  const [tab, setTab] = useState<'posts' | 'grade'>('posts')

  const gradeInfo = getGradeInfo(MOCK_USER.grade)
  const nextGrade = MOCK_USER.grade < 10 ? getGradeInfo(MOCK_USER.grade + 1) : null
  
  // 다음 등급까지 진행률 계산
  const currentMin = gradeInfo.min
  const nextMin = nextGrade ? nextGrade.min : gradeInfo.min
  const progress = nextGrade 
    ? Math.min(100, ((MOCK_USER.influence - currentMin) / (nextMin - currentMin)) * 100)
    : 100

  return (
    <div className="fade-in">
      {/* 헤더 배너 */}
      <div
        style={{
          height: 110,
          background: `linear-gradient(135deg, ${gradeInfo.color}40, ${gradeInfo.color}10 60%, transparent)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {gradeInfo.glow && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(105deg, transparent 40%, ${gradeInfo.color}18 50%, transparent 60%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s linear infinite',
            }}
          />
        )}
      </div>

      <div style={{ padding: '0 16px', marginTop: -50 }}>
        {/* 아바타 + 편집 버튼 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
          <div
            className={gradeInfo.glow ? 'grade-glow' : ''}
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              border: `3px solid ${C.bg}`,
              background: `linear-gradient(135deg, ${gradeInfo.grad[0]}, ${gradeInfo.grad[gradeInfo.grad.length - 1]})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
              color: 'white',
              boxShadow: gradeInfo.glow ? `0 4px 20px ${gradeInfo.color}70` : 'none',
              // @ts-expect-error -- supabase type workaround
              '--gc': `${gradeInfo.color}88`,
              flexShrink: 0,
            }}
          >
            {MOCK_USER.nickname[0]}
          </div>
          <Link href="/profile/edit">
            <Button primary small>프로필 편집</Button>
          </Link>
        </div>

        {/* 이름 + 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{MOCK_USER.nickname}</h1>
          {MOCK_USER.isPremium && <span style={{ fontSize: 10, color: '#FBBF24' }}>✦ 프리미엄</span>}
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
              background: `linear-gradient(135deg, ${gradeInfo.grad[0]}, ${gradeInfo.grad[gradeInfo.grad.length - 1]})`,
              color: 'white',
              boxShadow: gradeInfo.glow ? `0 2px 10px ${gradeInfo.color}60` : 'none',
            }}
          >
            {gradeInfo.badge} {gradeInfo.name}
          </span>
        </div>

        {/* 소개 */}
        <p style={{ fontSize: 13, color: C.w35, lineHeight: 1.6, marginBottom: 12 }}>{MOCK_USER.bio}</p>

        {/* 통계 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {[
            ['게시글', MOCK_USER.postCount.toString()],
            ['팔로워', MOCK_USER.followerCount >= 1000 ? `${(MOCK_USER.followerCount / 1000).toFixed(1)}천` : MOCK_USER.followerCount.toString()],
            ['팔로잉', MOCK_USER.followingCount.toString()],
            ['포인트', MOCK_USER.points.toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{value}</p>
              <p style={{ fontSize: 11, color: C.w20 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* 출석 현황 */}
        <div style={{ padding: 14, borderRadius: 14, background: C.s2, border: `1px solid ${C.w05}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🔥 출석 현황</span>
            <Button primary small>오늘 출석</Button>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{MOCK_USER.consecutiveAttendance}일</p>
              <p style={{ fontSize: 11, color: C.w20 }}>연속 출석</p>
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{MOCK_USER.totalAttendance}일</p>
              <p style={{ fontSize: 11, color: C.w20 }}>누적 출석</p>
            </div>
          </div>
        </div>

        {/* 등급 진행 */}
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: C.s2,
            border: `1px solid ${gradeInfo.color}30`,
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {gradeInfo.glow && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${gradeInfo.color}06, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{gradeInfo.badge}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: gradeInfo.color }}>{gradeInfo.name}</p>
                <p style={{ fontSize: 10, color: C.w20 }}>현재 등급</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: gradeInfo.color }}>{MOCK_USER.influence.toLocaleString()}</p>
              <p style={{ fontSize: 10, color: C.w20 }}>영향력 점수</p>
            </div>
          </div>

          {/* 진행바 */}
          <div style={{ height: 10, borderRadius: 6, background: C.w05, overflow: 'hidden', marginBottom: 8 }}>
            <div
              style={{
                height: '100%',
                borderRadius: 6,
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${gradeInfo.grad[0]}, ${gradeInfo.grad[gradeInfo.grad.length - 1]})`,
                boxShadow: gradeInfo.glow ? `0 0 8px ${gradeInfo.color}` : 'none',
                transition: 'width 0.6s ease',
              }}
            />
          </div>

          {nextGrade ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, color: C.w35 }}>
                다음: <span style={{ color: nextGrade.color, fontWeight: 700 }}>{nextGrade.badge} {nextGrade.name}</span>
              </p>
              <p style={{ fontSize: 11, color: gradeInfo.color, fontWeight: 700 }}>
                +{(nextGrade.min - MOCK_USER.influence).toLocaleString()}점 필요
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#FFD700', fontWeight: 700, textAlign: 'center' }}>🏆 최고 등급 달성!</p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.w05}` }}>
        {[
          { id: 'posts', label: '게시글' },
          { id: 'grade', label: '등급' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            style={{
              flex: 1,
              padding: '11px 0',
              fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? C.text : C.w35,
              borderBottom: `2.5px solid ${tab === t.id ? C.brand : 'transparent'}`,
              background: 'none',
              border: 'none',
              borderBottomStyle: 'solid',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {tab === 'posts' ? (
        <div style={{ paddingBottom: 20 }}>
          {MOCK_USER_POSTS.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(GRADES).map(([level, info]) => {
            const levelNum = parseInt(level)
            const isCurrent = levelNum === MOCK_USER.grade
            const isPassed = levelNum < MOCK_USER.grade
            const isLocked = !isPassed && !isCurrent

            return (
              <div
                key={level}
                className={`fade-in ${info.glow && !isLocked ? 'grade-glow' : ''}`}
                style={{
                  padding: '14px 16px',
                  borderRadius: 18,
                  background: isLocked ? C.s2 : isCurrent ? `${info.grad[0]}10` : C.s2,
                  border: isCurrent ? `1.5px solid ${info.color}50` : `1px solid ${C.w03}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: isLocked ? 0.32 : 1,
                  // @ts-expect-error -- supabase type workaround
                  '--gc': `${info.color}88`,
                }}
              >
                <span style={{ fontSize: 24 }}>{info.badge}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: isLocked ? C.w35 : info.color }}>{info.name}</p>
                  <p style={{ fontSize: 11, color: C.w20 }}>{info.perk}</p>
                </div>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: isLocked ? C.w05 : `linear-gradient(135deg, ${info.grad[0]}, ${info.grad[info.grad.length - 1]})`,
                    border: isLocked ? `1px solid ${C.w05}` : `1px solid ${info.color}44`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isLocked ? C.w20 : 'white',
                      fontFamily: 'monospace',
                    }}
                  >
                    Lv.{level}
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
