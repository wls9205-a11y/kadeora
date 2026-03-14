import { createClient } from '@/lib/supabase/server'
import { formatChangePct } from '@/lib/utils'

export async function StockTickerBar() {
  const supabase = await createClient()

  const { data: stocks } = await supabase
    .from('stock_quotes')
    .select('symbol, name, price, change_pct')
    .order('volume', { ascending: false })
    .limit(20)

  if (!stocks || stocks.length === 0) return null

  return (
    <div className="bg-[#111111] border-b border-white/[0.04] h-8 overflow-hidden flex items-center">
      <div className="flex animate-marquee gap-8 items-center">
        {[...stocks, ...stocks].map((stock, idx) => {
          const isUp = (stock.change_pct ?? 0) > 0
          const isDown = (stock.change_pct ?? 0) < 0

          return (
            <span key={`${stock.symbol}-${idx}`} className="flex items-center gap-1.5 whitespace-nowrap text-xs">
              <span className="text-white/50">{stock.name}</span>
              {stock.price && (
                <span className="font-mono font-medium text-white/80">
                  {stock.price.toLocaleString()}
                </span>
              )}
              {stock.change_pct !== null && (
                <span className={isUp ? 'text-red-400' : isDown ? 'text-blue-400' : 'text-white/30'}>
                  {formatChangePct(stock.change_pct)}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
