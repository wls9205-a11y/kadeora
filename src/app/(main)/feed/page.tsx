'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { CATEGORIES } from '@/lib/utils'
import { StockTicker, PostCard, RegionSelector } from '@/components/features'

// 임시 게시글 데이터 (실제로는 서버에서 가져옴)
const MOCK_POSTS = [
  {
    id: '1',
    author_id: '1',
    category: 'stock' as const,
    title: '삼성전자 9만전자 가능할까요?',
    content: '반도체 사이클 회복기에 접어든 것 같은데 여러분 의견은? HBM 수요가 폭발적으로 늘고 있고 TSMC도 CAPEX를 늘리는 상황입니다.',
    tags: ['삼성전자', '반도체'],
    is_anonymous: false,
    is_hot: true,
    is_premium: false,
    likes_count: 342,
    comments_count: 89,
    views_count: 2841,
    region: '서울',
    created_at: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    author: { id: '1', nickname: '투자의신', grade: 7, influence: 5200, avatar_url: null, bio: null, region: null, interests: null, is_premium: false, points: 0, consecutive_attendance: 0, total_attendance: 0, follower_count: 0, following_count: 0, post_count: 0, created_at: '', updated_at: '' },
  },
  {
    id: '2',
    author_id: '2',
    category: 'housing' as const,
    title: '래미안 원베일리 전매 풀리면 얼마나 오를까',
    content: '입주까지 1년 남았는데 전매제한 해제되면 가격이 어느정도 갈지 궁금합니다. 주변 시세 대비 아직 갭이 있다고 봐요.',
    tags: ['래미안', '서초'],
    is_anonymous: false,
    is_hot: true,
    is_premium: false,
    likes_count: 156,
    comments_count: 67,
    views_count: 1523,
    region: '서울',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    author: { id: '2', nickname: '부린이탈출', grade: 5, influence: 1800, avatar_url: null, bio: null, region: null, interests: null, is_premium: false, points: 0, consecutive_attendance: 0, total_attendance: 0, follower_count: 0, following_count: 0, post_count: 0, created_at: '', updated_at: '' },
  },
  {
    id: '3',
    author_id: '3',
    category: 'local' as const,
    title: '[부산] 해운대 센텀시티 상권 변화 체감',
    content: '최근에 센텀시티 쪽 공실률이 줄어든 느낌인데 저만 그런가요? 주변 가게들이 많이 바뀌었더라고요. 특히 IT 기업들이 많이 입주한 듯.',
    tags: null,
    is_anonymous: true,
    is_hot: false,
    is_premium: false,
    likes_count: 87,
    comments_count: 34,
    views_count: 892,
    region: '부산',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    author_id: '4',
    category: 'stock' as const,
    title: '코스닥 900 재돌파 의견 나눠봐요',
    content: 'AI 관련주 중심으로 수급이 몰리고 있는데, 이번에는 900선 안착 가능할까요? 외인 수급이 관건이라 봅니다.',
    tags: ['코스닥', 'AI'],
    is_anonymous: false,
    is_hot: true,
    is_premium: true,
    likes_count: 234,
    comments_count: 112,
    views_count: 3201,
    region: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    author: { id: '4', nickname: '차트분석가', grade: 8, influence: 9200, avatar_url: null, bio: null, region: null, interests: null, is_premium: true, points: 0, consecutive_attendance: 0, total_attendance: 0, follower_count: 0, following_count: 0, post_count: 0, created_at: '', updated_at: '' },
  },
  {
    id: '5',
    author_id: '5',
    category: 'free' as const,
    title: '요즘 재테크 뭐하세요?',
    content: '금리도 내려가고 주식도 불안하고... 다들 어디에 투자하고 계신가요? 저는 최근 배당주로 갈아타고 있습니다.',
    tags: null,
    is_anonymous: false,
    is_hot: true,
    is_premium: false,
    likes_count: 421,
    comments_count: 156,
    views_count: 5673,
    region: null,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    author: { id: '5', nickname: '월급루팡', grade: 3, influence: 450, avatar_url: null, bio: null, region: null, interests: null, is_premium: false, points: 0, consecutive_attendance: 0, total_attendance: 0, follower_count: 0, following_count: 0, post_count: 0, created_at: '', updated_at: '' },
  },
]

export default function FeedPage() {
  const { C } = useTheme()
  const [category, setCategory] = useState('hot')
  const [regions, setRegions] = useState<string[]>(['전국'])
  const [showRegionSelector, setShowRegionSelector] = useState(false)

  // 카테고리 필터링
  const filteredPosts = category === 'hot'
    ? MOCK_POSTS.filter(p => p.is_hot).sort((a, b) => b.likes_count - a.likes_count)
    : MOCK_POSTS.filter(p => p.category === category)

  const displayPosts = filteredPosts.length > 0 ? filteredPosts : MOCK_POSTS

  const regionLabel = regions.includes('전국') ? '전국' : regions.join(' · ')

  return (
    <div>
      <StockTicker />

      {/* 지역 선택 버튼 */}
      <div
        style={{
          padding: '9px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderBottom: `1px solid ${C.w03}`,
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>📍</span>
        <button
          onClick={() => setShowRegionSelector(true)}
          style={{
            background: 'none',
            border: 'none',
            color: C.w50,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            {regionLabel}
          </span>
          <span style={{ fontSize: 10, color: C.w20, flexShrink: 0 }}>▼</span>
        </button>
        {!regions.includes('전국') && (
          <span style={{ fontSize: 11, color: C.w20, flexShrink: 0 }}>{regions.length}/3</span>
        )}
      </div>

      {/* 지역 선택 바텀시트 */}
      <RegionSelector
        isOpen={showRegionSelector}
        onClose={() => setShowRegionSelector(false)}
        selected={regions}
        onSelect={setRegions}
      />

      {/* 카테고리 탭 */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: `1px solid ${C.w05}`,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: `${C.bg}f0`,
          backdropFilter: 'blur(10px)',
        }}
      >
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              padding: '11px 15px',
              fontSize: 13,
              fontWeight: category === cat.id ? 700 : 500,
              color: category === cat.id ? C.text : C.w35,
              borderBottom: `2.5px solid ${category === cat.id ? C.brand : 'transparent'}`,
              background: 'none',
              border: 'none',
              borderBottomStyle: 'solid',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 11 }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* 확성기 배너 */}
      <div
        style={{
          margin: '10px 14px 2px',
          padding: '11px 14px',
          borderRadius: 12,
          background: `linear-gradient(135deg, ${C.brand}12, rgba(255,140,0,0.06))`,
          border: `1px solid ${C.brand}18`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>📢</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            3월 부동산 분양 일정 총정리! 서울/경기 위주
          </p>
          <p style={{ fontSize: 11, color: C.w35 }}>부동산마스터 · 광고</p>
        </div>
        <span style={{ fontSize: 10, color: C.w20, flexShrink: 0 }}>AD</span>
      </div>

      {/* 게시글 목록 */}
      {displayPosts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
