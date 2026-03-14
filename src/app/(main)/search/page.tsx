'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { SubHeader } from '@/components/layout'
import { PostCard } from '@/components/features'
import { EmptyState } from '@/components/ui'
import { SearchIcon, CloseIcon } from '@/components/ui/Icons'

const POPULAR_TAGS = ['삼성전자', '반도체', '분양', '코스닥', '래미안', 'AI', '배당주', '2차전지']

const MOCK_SEARCH_RESULTS = [
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

export default function SearchPage() {
  const { C } = useTheme()
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = () => {
    if (query.trim()) {
      setHasSearched(true)
    }
  }

  const handleTagClick = (tag: string) => {
    setQuery(tag)
    setHasSearched(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <SubHeader title="검색" />

      {/* 검색창 */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.w05}` }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <SearchIcon />
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="검색어를 입력하세요"
            autoFocus
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              border: `1px solid ${C.w10}`,
              background: C.s2,
              color: C.text,
              fontSize: 15,
              paddingLeft: 40,
              paddingRight: query ? 40 : 14,
              outline: 'none',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setHasSearched(false); }}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="scrollable" style={{ flex: 1 }}>
        {!hasSearched ? (
          /* 인기 검색어 */
          <div style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>🔥 인기 검색어</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: `1px solid ${C.w10}`,
                    background: C.s2,
                    color: C.w50,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        ) : query.toLowerCase().includes('삼성') ? (
          /* 검색 결과 */
          <div>
            <p style={{ padding: '12px 16px', fontSize: 12, color: C.w35 }}>
              &apos;{query}&apos; 검색 결과 1건
            </p>
            {MOCK_SEARCH_RESULTS.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          /* 결과 없음 */
          <EmptyState emoji="🔍" text={`'${query}'에 대한 검색 결과가 없어요`} />
        )}
      </div>
    </div>
  )
}
