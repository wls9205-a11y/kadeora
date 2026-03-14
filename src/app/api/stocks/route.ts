import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 한국거래소 KRX 오픈 API 또는 네이버 금융 스크레이핑
// 현재는 더미 데이터 구조 — 실제 API 키 연동 시 교체
export async function POST(request: NextRequest) {
  // 크론잡 인증 (Vercel Cron 또는 외부 서비스)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  try {
    // KIS(한국투자증권) API 또는 데이터포탈 사용 시 여기서 fetch
    // 예시: const res = await fetch(`https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price?...`)

    // 현재는 stock_quotes 테이블에서 기존 종목 목록 가져와서 업데이트
    const { data: existingStocks } = await supabase
      .from('stock_quotes')
      .select('symbol, name, market')

    if (!existingStocks || existingStocks.length === 0) {
      return NextResponse.json({ message: 'No stocks to update' })
    }

    // TODO: 실제 API 호출로 교체
    // 현재는 ±5% 범위 랜덤 변동 시뮬레이션 (개발용)
    const updates = existingStocks.map(stock => {
      const changePct = (Math.random() - 0.48) * 10  // -4.8% ~ +5.2%
      const basePrice = Math.floor(Math.random() * 90000) + 10000
      const changeAmt = Math.floor(basePrice * changePct / 100)

      return {
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        price: basePrice,
        change_amt: changeAmt,
        change_pct: parseFloat(changePct.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000),
        updated_at: new Date().toISOString(),
      }
    })

    const { error } = await supabase
      .from('stock_quotes')
      .upsert(updates, { onConflict: 'symbol' })

    if (error) throw error

    // 동기화 로그 업데이트
    await supabase.from('sync_log').upsert({
      target: 'stock_quotes',
      synced_at: new Date().toISOString(),
      row_count: updates.length,
    }, { onConflict: 'target' })

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (error) {
    console.error('Stock sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

// GET: 현재 시세 조회
export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stock_quotes')
    .select('*')
    .order('volume', { ascending: false })
    .limit(50)

  return NextResponse.json({ stocks: data ?? [], timestamp: new Date().toISOString() })
}
