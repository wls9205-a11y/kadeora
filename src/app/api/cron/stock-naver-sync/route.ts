import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://m.stock.naver.com/' };
const CLAMP = (v: number) => Math.max(-30, Math.min(30, v));

interface NaverQuote {
  symbol: string;
  price: number;
  change_pct: number;
  change_amt: number;
  volume: number;
  market_cap: number;
}

// 네이버 모바일 API — 개별 종목
async function fetchNaverSingle(symbol: string): Promise<NaverQuote | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: HEADERS, signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const price = parseInt(String(j?.closePrice ?? '0').replace(/,/g, ''));
    if (!price) return null;
    return {
      symbol,
      price,
      change_pct: CLAMP(parseFloat(String(j?.fluctuationsRatio ?? '0'))),
      change_amt: parseInt(String(j?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
      volume: parseInt(String(j?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
      market_cap: parseInt(String(j?.marketCap ?? '0').replace(/,/g, '')),
    };
  } catch { return null; }
}

// 네이버 해외주식 API — 개별 종목 (NASDAQ=.O, NYSE=.N)
async function fetchNaverWorldStock(symbol: string, market: string): Promise<NaverQuote | null> {
  const suffix = market === 'NASDAQ' ? '.O' : '.N';
  const naverSymbol = `${symbol}${suffix}`;
  try {
    const res = await fetch(`https://api.stock.naver.com/stock/${naverSymbol}/basic`, {
      headers: { ...HEADERS, Referer: 'https://m.stock.naver.com/worldstock/' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      // suffix 없이 재시도
      const res2 = await fetch(`https://api.stock.naver.com/stock/${symbol}/basic`, {
        headers: { ...HEADERS, Referer: 'https://m.stock.naver.com/worldstock/' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res2.ok) return null;
      const j2 = await res2.json();
      const price2 = parseFloat(String(j2?.closePrice ?? '0').replace(/,/g, ''));
      if (!price2) return null;
      return {
        symbol,
        price: price2,
        change_pct: CLAMP(parseFloat(String(j2?.fluctuationsRatio ?? '0'))),
        change_amt: parseFloat(String(j2?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
        volume: parseInt(String(j2?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
        market_cap: 0,
      };
    }
    const j = await res.json();
    const price = parseFloat(String(j?.closePrice ?? '0').replace(/,/g, ''));
    if (!price) return null;
    return {
      symbol,
      price,
      change_pct: CLAMP(parseFloat(String(j?.fluctuationsRatio ?? '0'))),
      change_amt: parseFloat(String(j?.compareToPreviousClosePrice ?? '0').replace(/,/g, '')),
      volume: parseInt(String(j?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
      market_cap: 0,
    };
  } catch { return null; }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  let krSuccess = 0, krFailed = 0, usSuccess = 0, usFailed = 0;

  // ═══ 시간외 가격 차단 ═══
  // 15:35 KST 이후에는 국내 시세 갱신 스킵 (시간외 거래 가격 오염 방지)
  const kstNow = new Date(Date.now() + 9 * 3600000);
  const kstHour = kstNow.getUTCHours();
  const kstMin = kstNow.getUTCMinutes();
  const isAfterHours = kstHour > 15 || (kstHour === 15 && kstMin >= 35);

  // ═══ 1. 국내 주식 (KOSPI + KOSDAQ) — 시총순 상위 500개 네이버 크롤링 ═══
  // 15:35 KST 이후 스킵 (시간외 거래 가격 오염 방지 — 정규장 종가만 수집)
  if (!isAfterHours) {
  const { data: krStocks } = await sb.from('stock_quotes')
    .select('symbol')
    .in('market', ['KOSPI', 'KOSDAQ'])
    .eq('is_active', true)
    .gt('price', 0)
    .order('market_cap', { ascending: false })
    .limit(500);

  if (krStocks?.length) {
    const BATCH = 15;
    for (let i = 0; i < krStocks.length; i += BATCH) {
      const batch = krStocks.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (s: any) => {
          const q = await fetchNaverSingle(s.symbol);
          if (q && q.price > 0) {
            const updates: Record<string, any> = {
              price: q.price,
              change_pct: q.change_pct,
              change_amt: q.change_amt,
              updated_at: new Date().toISOString(),
            };
            if (q.volume > 0) updates.volume = q.volume;
            if (q.market_cap > 0) updates.market_cap = q.market_cap;
            await sb.from('stock_quotes').update(updates).eq('symbol', q.symbol);
            return true;
          }
          return false;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) krSuccess++;
        else krFailed++;
      }
      if (i + BATCH < krStocks.length) await sleep(80);
    }
  }
  } // end isAfterHours guard

  // ═══ 2. 해외 주식 (NYSE + NASDAQ) — 네이버 해외주식 API ═══
  const { data: usStocks } = await sb.from('stock_quotes')
    .select('symbol, market')
    .in('market', ['NYSE', 'NASDAQ'])
    .eq('is_active', true)
    .gt('price', 0)
    .order('market_cap', { ascending: false })
    .limit(500);

  if (usStocks?.length) {
    const BATCH = 20;
    for (let i = 0; i < usStocks.length; i += BATCH) {
      const batch = usStocks.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (s: any) => {
          const q = await fetchNaverWorldStock(s.symbol, s.market);
          if (q && q.price > 0) {
            const updates: Record<string, any> = {
              price: q.price,
              change_pct: q.change_pct,
              change_amt: q.change_amt,
              updated_at: new Date().toISOString(),
            };
            if (q.volume > 0) updates.volume = q.volume;
            await sb.from('stock_quotes').update(updates).eq('symbol', q.symbol);
            return true;
          }
          return false;
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) usSuccess++;
        else usFailed++;
      }
      if (i + BATCH < usStocks.length) await sleep(60);
    }
  }

  // ═══ 3. price_history에 오늘 종가 기록 ═══
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: updated } = await sb.from('stock_quotes')
      .select('symbol, price, change_pct, volume')
      .gt('price', 0)
      .order('market_cap', { ascending: false })
      .limit(500);

    if (updated?.length) {
      const historyRows = updated.map((s: any) => ({
        symbol: s.symbol,
        date: today,
        close_price: s.price,
        change_pct: s.change_pct ?? 0,
        volume: s.volume ?? 0,
      }));
      // 100개씩 upsert
      for (let i = 0; i < historyRows.length; i += 100) {
        await (sb as any).from('stock_price_history')
          .upsert(historyRows.slice(i, i + 100), { onConflict: 'symbol,date' });
      }
    }
  } catch {}

  // ═══ KOSPI/KOSDAQ 지수 자동 갱신 ═══
  try {
    const indices = [
      { symbol: 'KOSPI_IDX', naverCode: 'KOSPI', name: 'KOSPI' },
      { symbol: 'KOSDAQ_IDX', naverCode: 'KOSDAQ', name: 'KOSDAQ' },
    ];
    for (const idx of indices) {
      try {
        // 네이버 국내지수 API
        const res = await fetch(`https://m.stock.naver.com/api/index/${idx.naverCode}/basic`, {
          headers: HEADERS, signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const j = await res.json();
          // 지수 API는 개별종목과 필드명이 다를 수 있음 — 여러 필드 시도
          const price = parseFloat(String(j?.closePrice ?? j?.currentPrice ?? j?.now ?? j?.indexValue ?? '0').replace(/,/g, ''));
          const pct = parseFloat(String(j?.fluctuationsRatio ?? j?.changeRate ?? '0'));
          const amt = parseFloat(String(j?.compareToPreviousClosePrice ?? j?.changeValue ?? j?.change ?? '0').replace(/,/g, ''));
          if (price > 100) { // 지수는 최소 100 이상이어야 정상
            await sb.from('stock_quotes').update({
              price,
              change_pct: CLAMP(pct),
              change_amt: amt || null,
              updated_at: new Date().toISOString(),
            }).eq('symbol', idx.symbol);
          }
        }
      } catch {
        // 네이버 API 실패 시 — price는 건드리지 않고 change_pct만 시장 평균으로 갱신
        // (지수 price가 틀리면 그대로 두는 게 차라리 나음)
      }
    }
  } catch {}

  // ═══ 로깅 ═══
  try {
    await (sb as any).from('cron_logs').insert({
      cron_name: 'stock-naver-sync',
      status: 'success',
      records_processed: krSuccess + usSuccess + krFailed + usFailed,
      records_updated: krSuccess + usSuccess,
      records_failed: krFailed + usFailed,
      metadata: { krSuccess, krFailed, usSuccess, usFailed },
    });
  } catch {}

  return NextResponse.json({
    ok: true,
    kr: { success: krSuccess, failed: krFailed },
    us: { success: usSuccess, failed: usFailed },
  });
}
