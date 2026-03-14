'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { SearchIcon } from '@/components/ui/Icons'

const MOCK_ROOMS = [
  { id: '1', name: '삼성전자', type: 'stock', members: 3247, lastMsg: '오늘 분위기 좋네요 🚀', active: true },
  { id: '2', name: 'SK하이닉스', type: 'stock', members: 1892, lastMsg: 'HBM 수주 소식 들으셨나요?', active: true },
  { id: '3', name: '래미안 레벤투스', type: 'housing', members: 456, lastMsg: '분양 일정 확인하세요!', active: true },
  { id: '4', name: '코스닥 900', type: 'stock', members: 2341, lastMsg: '외인 순매수 계속 들어온다', active: false },
  { id: '5', name: '더샵 센텀포레', type: 'housing', members: 234, lastMsg: '부산 분양가 괜찮은 편인가요?', active: false },
  { id: '6', name: '에코프로비엠', type: 'stock', members: 1567, lastMsg: '바닥 다진 것 같은데...', active: true },
]

export default function DiscussPage() {
  const { C } = useTheme()
  const [filter, setFilter] = useState<'all' | 'stock' | 'housing'>('all')
  const [query, setQuery] = useState('')

  const filteredRooms = MOCK_ROOMS.filter(
    room => (filter === 'all' || room.type === filter) &&
            (!query || room.name.includes(query))
  )

  return (
    <div className="fade-in">
      <div style={{ padding: '16px 16px 10px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12 }}>토론방</h1>
        
        {/* 검색창 */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <SearchIcon />
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="토론방 검색"
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

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: '전체' },
            { id: 'stock', label: '📈 주식' },
            { id: 'housing', label: '🏠 부동산' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: filter === f.id ? C.brand : C.w05,
                color: filter === f.id ? 'white' : C.w50,
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 토론방 목록 */}
      <div style={{ padding: '0 14px 14px' }}>
        {filteredRooms.map((room, i) => (
          <Link
            key={room.id}
            href={`/discuss/${room.id}`}
            className="fade-in press-effect"
            style={{
              display: 'block',
              padding: '14px 16px',
              marginBottom: 8,
              borderRadius: 14,
              background: C.s2,
              border: `1px solid ${C.w05}`,
              textDecoration: 'none',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* 아이콘 */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: room.type === 'stock' ? `${C.brand}15` : `${C.bear}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {room.type === 'stock' ? '📈' : '🏠'}
              </div>

              {/* 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{room.name}</h3>
                  {room.active && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        background: '#34D399',
                      }}
                    />
                  )}
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: C.w35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {room.lastMsg}
                </p>
              </div>

              {/* 멤버 수 */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: C.w20 }}>
                  👥 {room.members.toLocaleString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
