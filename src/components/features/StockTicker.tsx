'use client'

import { useTheme } from '@/lib/theme'

// 임시 주식 데이터 (실제로는 API에서 가져옴)
const TICKER_STOCKS = [
  { name: '삼성전자', pct: 2.34 },
  { name: 'SK하이닉스', pct: -1.12 },
  { name: 'NAVER', pct: 0.87 },
  { name: '카카오', pct: -0.54 },
  { name: 'LG에너지솔루션', pct: 1.56 },
]

export function StockTicker() {
  const { C } = useTheme()

  const items = [...TICKER_STOCKS, ...TICKER_STOCKS] // 무한 스크롤용 복제

  return (
    <div
      style={{
        height: 32,
        overflow: 'hidden',
        borderBottom: `1px solid ${C.w03}`,
        background: C.s1,
      }}
    >
      <div
        className="ticker-scroll"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          width: 'max-content',
        }}
      >
        {items.map((stock, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 16px',
              borderRight: `1px solid ${C.w03}`,
            }}
          >
            <span style={{ fontSize: 12, color: C.w50 }}>{stock.name}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: stock.pct > 0 ? C.bull : stock.pct < 0 ? C.bear : C.w35,
              }}
            >
              {stock.pct > 0 ? '+' : ''}{stock.pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
