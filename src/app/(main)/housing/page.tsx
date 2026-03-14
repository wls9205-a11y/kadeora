'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { SearchIcon } from '@/components/ui/Icons'
import { PostCard } from '@/components/features'

const MOCK_SCHEDULES = [
  { name: '래미안 레벤투스', loc: '서울 서초구', units: 1247, dday: 3, hot: true, price: '12억~18억', start: '2026.03.18', end: '2026.03.20' },
  { name: '힐스테이트 세운', loc: '서울 중구', units: 889, dday: 7, hot: true, price: '8억~14억', start: '2026.03.22', end: '2026.03.24' },
  { name: '더샵 센텀포레', loc: '부산 해운대구', units: 2100, dday: 14, hot: false, price: '4억~7억', start: '2026.03.29', end: '2026.03.31' },
  { name: 'e편한세상 시티 과천', loc: '경기 과천시', units: 1508, dday: 21, hot: false, price: '9억~15억', start: '2026.04.05', end: '2026.04.07' },
  { name: '디에이치 아너힐즈', loc: '서울 강동구', units: 3200, dday: 28, hot: false, price: '10억~16억', start: '2026.04.12', end: '2026.04.14' },
]

const MOCK_HOUSING_POSTS = [
  {
    id: '101',
    author_id: '2',
    category: 'housing' as const,
    title: '래미안 원베일리 전매 풀리면 얼마나 오를까',
    content: '입주까지 1년 남았는데 전매제한 해제되면 가격이 어느정도 갈지 궁금합니다.',
    tags: ['래미안', '서초'],
    is_anonymous: false,
    is_hot: true,
    is_premium: false,
    likes_count: 156,
    comments_count: 67,
    views_count: 1523,
    region: '서울',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author: { id: '2', nickname: '부린이탈출', grade: 5, influence: 1800, avatar_url: null, bio: null, region: null, interests: null, is_premium: false, points: 0, consecutive_attendance: 0, total_attendance: 0, follower_count: 0, following_count: 0, post_count: 0, created_at: '', updated_at: '' },
  },
]

export default function HousingPage() {
  const { C } = useTheme()
  const [tab, setTab] = useState<'schedule' | 'discuss'>('schedule')
  const [region, setRegion] = useState('전체')
  const [query, setQuery] = useState('')

  const regions = ['전체', '서울', '경기', '부산', '인천', '대구', '대전', '광주']

  const filteredSchedules = MOCK_SCHEDULES.filter(
    s => !query || s.name.includes(query)
  )

  return (
    <div className="fade-in">
      <div style={{ padding: '16px 16px 10px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12 }}>부동산 정보</h1>
        
        {/* 검색창 */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <SearchIcon />
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="단지명 검색"
            style={{
              width: '100%',
              height: 40,
              borderRadius: 12,
              border: `1px solid ${C.w05}`,
              background: C.s2,
              color: C.text,
              fontSize: 14,
              paddingLeft: 36,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 지역 필터 */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
          {regions.map(r => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: region === r ? C.brand : C.w05,
                color: region === r ? 'white' : C.w50,
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.w05}` }}>
        {[
          { id: 'schedule', label: '분양 일정' },
          { id: 'discuss', label: '부동산 토론' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'schedule' | 'discuss')}
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
      {tab === 'schedule' ? (
        <div>
          {filteredSchedules.map((schedule, i) => (
            <div
              key={i}
              className="fade-in"
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${C.w03}`,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    {schedule.hot && (
                      <span style={{ fontSize: 10, color: '#F97316', fontWeight: 700 }}>🔥 HOT</span>
                    )}
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{schedule.name}</h3>
                  </div>
                  <p style={{ fontSize: 12, color: C.w35, marginBottom: 3 }}>
                    📍 {schedule.loc} · {schedule.units.toLocaleString()}세대
                  </p>
                  <p style={{ fontSize: 12, color: C.w20 }}>
                    📅 {schedule.start} ~ {schedule.end}
                  </p>
                  <p style={{ fontSize: 12, color: C.w35, marginTop: 2 }}>{schedule.price}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 800,
                      background: schedule.dday <= 3 ? C.brand : schedule.dday <= 7 ? 'rgba(249,115,22,0.2)' : C.w05,
                      color: schedule.dday <= 3 ? 'white' : schedule.dday <= 7 ? '#F97316' : C.w50,
                    }}
                  >
                    D-{schedule.dday}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {MOCK_HOUSING_POSTS.map(post => (
            <PostCard key={post.id} post={post} showCategory={false} />
          ))}
        </div>
      )}
    </div>
  )
}
