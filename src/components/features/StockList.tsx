'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useState } from 'react'
import { cn, formatChangePct } from '@/lib/utils'
import type { StockQuote } from '@/types/database'

interface StockListProps {
  stocks: StockQuote[]
  currentMarket: string
  query: string
}

const MARKETS = [
  { id: 'all', label: '전체' },
  { id: 'KOSPI', label: 'KOSPI' },
  { id: 'KOSDAQ', label: 'KOSDAQ' },
]

export function StockList({ stocks, currentMarket, query }: StockListProps) {
  const [search, setSearch] = useState(query)
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleSearch(value: string) {
    setSearch(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('q', value)
    else params.delete('q')
    router.push(`/stocks?${params.toString()}`)
  }

  function handleMarket(marketId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (marketId !== 'all') params.set('market', marketId)
    else params.delete('market')
    router.push(`/stocks?${params.toString()}`)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-white mb-3">주식 토론</h1>

        {/* 검색 */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="종목명 또는 코드 검색"
            className="input-base pl-9 text-sm h-10"
          />
        </div>

        {/* 마켓 필터 */}
        <div className="flex gap-2">
          {MARKETS.map(m => (
            <button
              key={m.id}
              onClick={() => handleMarket(m.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                currentMarket === m.id
                  ? 'bg-brand text-white'
                  : 'bg-white/[0.06] text-white/50 hover:bg-white/10'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 시세 테이블 */}
      {stocks.length > 0 && (
        <div className="mx-4 mb-4 card overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 border-b border-white/[0.06]">
            <span className="text-[11px] text-white/30">종목</span>
            <span className="text-[11px] text-white/30 text-right">현재가</span>
            <span className="text-[11px] text-white/30 text-right w-16">등락률</span>
          </div>

          {/* 종목 리스트 */}
          {stocks.map((stock, idx) => {
            const isUp = (stock.change_pct ?? 0) > 0
            const isDown = (stock.change_pct ?? 0) < 0
            const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus
            const colorClass = isUp ? 'text-bull' : isDown ? 'text-bear' : 'text-white/30'

            return (
              <button
                key={stock.symbol}
                onClick={() => handleSearch(stock.symbol)}
                className={cn(
                  'w-full grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2.5 items-center',
                  'hover:bg-white/[0.03] transition-colors',
                  idx < stocks.length - 1 && 'border-b border-white/[0.04]'
                )}
              >
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{stock.name}</p>
                  <p className="text-[11px] text-white/30">{stock.symbol} · {stock.market}</p>
                </div>
                <p className="text-[14px] font-mono font-semibold text-white text-right">
                  {stock.price?.toLocaleString() ?? '-'}
                </p>
                <div className={cn('flex items-center gap-1 justify-end w-16', colorClass)}>
                  <Icon size={11} />
                  <span className="text-[12px] font-medium font-mono">
                    {stock.change_pct !== null ? formatChangePct(stock.change_pct) : '-'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
