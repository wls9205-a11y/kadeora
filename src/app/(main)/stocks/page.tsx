'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/theme'
import { SearchIcon, CloseIcon } from '@/components/ui/Icons'
import { EmptyState } from '@/components/ui'

const MOCK_STOCKS = [
  { name: '삼성전자', code: '005930', market: 'KOSPI', price: 87400, pct: 2.34, vol: 18245000 },
  { name: 'SK하이닉스', code: '000660', market: 'KOSPI', price: 234500, pct: -1.12, vol: 5432000 },
  { name: 'NAVER', code: '035420', market: 'KOSPI', price: 215000, pct: 0.87, vol: 1235000 },
  { name: '카카오', code: '035720', market: 'KOSPI', price: 58900, pct: -0.54, vol: 3421000 },
  { name: 'LG에너지솔루션', code: '373220', market: 'KOSPI', price: 378000, pct: 1.56, vol: 892000 },
  { name: '현대차', code: '005380', market: 'KOSPI', price: 248000, pct: 0.41, vol: 1523000 },
  { name: '셀트리온', code: '068270', market: 'KOSPI', price: 198500, pct: -2.01, vol: 2341000 },
  { name: '에코프로비엠', code: '247540', market: 'KOSDAQ', price: 198700, pct: 3.45, vol: 4521000 },
  { name: 'HLB', code: '028300', market: 'KOSDAQ', price: 78500, pct: -1.23, vol: 6234000 },
  { name: '알테오젠', code: '196170', market: 'KOSDAQ', price: 312000, pct: 2.11, vol: 1892000 },
]

export default function StocksPage() {
  const { C } = useTheme()
  const [market, setMarket] = useState('all')
  const [query, setQuery] = useState('')

  const filteredStocks = MOCK_STOCKS.filter(
    s => (market === 'all' || s.market === market) && 
         (!query || s.name.includes(query) || s.code.includes(query))
  )

  return (
    <div className="fade-in">
      <div style={{ padding: '16px 16px 10px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12 }}>주식 토론</h1>
        
        {/* 검색창 */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <SearchIcon />
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="종목명 또는 코드 검색"
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
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        {/* 시장 필터 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'KOSPI', 'KOSDAQ'].map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: market === m ? C.brand : C.w05,
                color: market === m ? 'white' : C.w50,
                transition: 'all 0.15s',
              }}
            >
              {m === 'all' ? '전체' : m}
            </button>
          ))}
        </div>
      </div>

      {/* 주식 목록 */}
      <div
        style={{
          margin: '4px 14px 14px',
          borderRadius: 14,
          overflow: 'hidden',
          background: C.s2,
          border: `1px solid ${C.w05}`,
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 70px',
            padding: '8px 14px',
            borderBottom: `1px solid ${C.w05}`,
          }}
        >
          <span style={{ fontSize: 11, color: C.w20 }}>종목</span>
          <span style={{ fontSize: 11, color: C.w20, textAlign: 'right' }}>현재가</span>
          <span style={{ fontSize: 11, color: C.w20, textAlign: 'right' }}>등락률</span>
        </div>

        {/* 목록 */}
        {filteredStocks.length === 0 ? (
          <EmptyState emoji="🔍" text="검색 결과가 없어요" />
        ) : (
          filteredStocks.map((stock, i) => (
            <Link
              key={stock.code}
              href={`/discuss/${stock.code}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 70px',
                padding: '11px 14px',
                alignItems: 'center',
                cursor: 'pointer',
                borderBottom: i < filteredStocks.length - 1 ? `1px solid ${C.w03}` : 'none',
                textDecoration: 'none',
                transition: 'background 0.1s',
              }}
              className="press-effect"
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{stock.name}</p>
                <p style={{ fontSize: 11, color: C.w20 }}>{stock.code} · {stock.market}</p>
              </div>
              <p style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: C.text, textAlign: 'right' }}>
                {stock.price.toLocaleString()}
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: stock.pct > 0 ? C.bull : stock.pct < 0 ? C.bear : C.w35,
                  textAlign: 'right',
                }}
              >
                {stock.pct > 0 ? '+' : ''}{stock.pct.toFixed(2)}%
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
