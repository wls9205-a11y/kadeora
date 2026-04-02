import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://finance.naver.com/' };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface DiscoveredStock {
  symbol: string; name: string; market: string; price: number;
  change_pct: number; market_cap: number; volume: number; currency: string;
}

// ═══ 네이버 시총순 종목 크롤링 (HTML 파싱) ═══
// finance.naver.com/sise/sise_market_sum.naver — 실제로 작동하는 검증된 URL
async function fetchNaverMarketCap(market: 'kospi' | 'kosdaq', pages: number = 3): Promise<DiscoveredStock[]> {
  const results: DiscoveredStock[] = [];
  const marketLabel = market === 'kospi' ? 'KOSPI' : 'KOSDAQ';

  for (let page = 1; page <= pages; page++) {
    try {
      const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${market === 'kospi' ? '0' : '1'}&page=${page}`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const html = await res.text();

      // HTML에서 종목 추출 — <a href="/item/main.naver?code=005930">삼성전자</a> 패턴
      const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
      for (const row of rows) {
        const codeMatch = row.match(/code=([0-9]{6})/);
        const nameMatch = row.match(/class="tltle"[^>]*>([^<]+)</);
        if (!codeMatch || !nameMatch) continue;

        const symbol = codeMatch[1];
        const name = nameMatch[1].trim();

        // 가격, 등락률, 시총, 거래량 추출 (td 순서)
        const tds = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
        const vals = tds.map(td => {
          const v = td.replace(/<[^>]*>/g, '').replace(/,/g, '').trim();
          return parseFloat(v) || 0;
        });

        // 일반적으로: [순위, 종목명, 현재가, 전일비, 등락률, 시가총액, ...]
        const price = vals[2] || 0;
        const changePct = vals[4] || 0;
        const marketCap = vals[5] ? vals[5] * 100000000 : 0; // 네이버는 억 단위

        if (price > 0 && symbol) {
          results.push({
            symbol, name, market: marketLabel, price,
            change_pct: Math.max(-30, Math.min(30, changePct)),
            market_cap: marketCap, volume: vals[8] || 0, currency: 'KRW',
          });
        }
      }
    } catch { /* continue */ }
    await sleep(300);
  }
  return results;
}

// ═══ 네이버 개별 종목 API (시세+시총 정확값) ═══
async function fetchNaverSingle(symbol: string): Promise<{ price: number; market_cap: number; change_pct: number; volume: number } | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': 'https://m.stock.naver.com/' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      price: parseInt(String(j?.closePrice ?? '0').replace(/,/g, '')),
      market_cap: parseInt(String(j?.marketCap ?? '0').replace(/,/g, '')),
      change_pct: Math.max(-30, Math.min(30, parseFloat(String(j?.fluctuationsRatio ?? '0')))),
      volume: parseInt(String(j?.accumulatedTradingVolume ?? '0').replace(/,/g, '')),
    };
  } catch { return null; }
}

// ═══ 한국 주요 종목 하드코딩 (네이버 TOP 50 기준, 절대 누락 방지) ═══
const MUST_HAVE_KR: { symbol: string; name: string; market: string }[] = [
  { symbol: '005930', name: '삼성전자', market: 'KOSPI' },
  { symbol: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { symbol: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  { symbol: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  { symbol: '035420', name: 'NAVER', market: 'KOSPI' },
  { symbol: '035720', name: '카카오', market: 'KOSPI' },
  { symbol: '051910', name: 'LG화학', market: 'KOSPI' },
  { symbol: '006400', name: '삼성SDI', market: 'KOSPI' },
  { symbol: '028260', name: '삼성물산', market: 'KOSPI' },
  { symbol: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { symbol: '003550', name: 'LG', market: 'KOSPI' },
  { symbol: '105560', name: 'KB금융', market: 'KOSPI' },
  { symbol: '055550', name: '신한지주', market: 'KOSPI' },
  { symbol: '066570', name: 'LG전자', market: 'KOSPI' },
  { symbol: '096770', name: 'SK이노베이션', market: 'KOSPI' },
  { symbol: '032830', name: '삼성생명', market: 'KOSPI' },
  { symbol: '000270', name: '기아', market: 'KOSPI' },
  { symbol: '012330', name: '현대모비스', market: 'KOSPI' },
  { symbol: '034730', name: 'SK', market: 'KOSPI' },
  { symbol: '015760', name: '한국전력', market: 'KOSPI' },
  { symbol: '003670', name: '포스코퓨처엠', market: 'KOSPI' },
  { symbol: '030200', name: 'KT', market: 'KOSPI' },
  { symbol: '086790', name: '하나금융지주', market: 'KOSPI' },
  { symbol: '316140', name: '우리금융지주', market: 'KOSPI' },
  { symbol: '047050', name: '포스코인터내셔널', market: 'KOSPI' },
  { symbol: '259960', name: '크래프톤', market: 'KOSPI' },
  { symbol: '011200', name: 'HMM', market: 'KOSPI' },
  { symbol: '010130', name: '고려아연', market: 'KOSPI' },
  { symbol: '033780', name: 'KT&G', market: 'KOSPI' },
  { symbol: '009150', name: '삼성전기', market: 'KOSPI' },
  { symbol: '005380', name: '현대차', market: 'KOSPI' },
  { symbol: '068270', name: '셀트리온', market: 'KOSPI' },
  { symbol: '017670', name: 'SK텔레콤', market: 'KOSPI' },
  { symbol: '018260', name: '삼성에스디에스', market: 'KOSPI' },
  { symbol: '034020', name: '두산에너빌리티', market: 'KOSPI' },
  { symbol: '010950', name: 'S-Oil', market: 'KOSPI' },
  { symbol: '009540', name: '한국조선해양', market: 'KOSPI' },
  { symbol: '267260', name: '현대일렉트릭', market: 'KOSPI' },
  { symbol: '329180', name: '현대중공업', market: 'KOSPI' },
  { symbol: '352820', name: '하이브', market: 'KOSPI' },
  { symbol: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
  { symbol: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ' },
  { symbol: '196170', name: '알테오젠', market: 'KOSDAQ' },
  { symbol: '403870', name: '에코프로머티', market: 'KOSDAQ' },
  { symbol: '041510', name: 'SM', market: 'KOSDAQ' },
  { symbol: '293490', name: '카카오게임즈', market: 'KOSDAQ' },
];

const MUST_HAVE_US: { symbol: string; name: string; market: string }[] = [
  { symbol: 'AAPL', name: 'Apple', market: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet', market: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon', market: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'NASDAQ' },
  { symbol: 'META', name: 'Meta', market: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla', market: 'NASDAQ' },
  { symbol: 'AVGO', name: 'Broadcom', market: 'NASDAQ' },
  { symbol: 'COST', name: 'Costco', market: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix', market: 'NASDAQ' },
  { symbol: 'ADBE', name: 'Adobe', market: 'NASDAQ' },
  { symbol: 'CRM', name: 'Salesforce', market: 'NYSE' },
  { symbol: 'AMD', name: 'AMD', market: 'NASDAQ' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway', market: 'NYSE' },
  { symbol: 'JPM', name: 'JPMorgan', market: 'NYSE' },
  { symbol: 'V', name: 'Visa', market: 'NYSE' },
  { symbol: 'UNH', name: 'UnitedHealth', market: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'NYSE' },
  { symbol: 'PG', name: 'Procter & Gamble', market: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard', market: 'NYSE' },
  { symbol: 'HD', name: 'Home Depot', market: 'NYSE' },
  { symbol: 'XOM', name: 'ExxonMobil', market: 'NYSE' },
  { symbol: 'LLY', name: 'Eli Lilly', market: 'NYSE' },
  { symbol: 'KO', name: 'Coca-Cola', market: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart', market: 'NYSE' },
  { symbol: 'DIS', name: 'Disney', market: 'NYSE' },
  { symbol: 'INTC', name: 'Intel', market: 'NASDAQ' },
  { symbol: 'QCOM', name: 'Qualcomm', market: 'NASDAQ' },
  { symbol: 'PYPL', name: 'PayPal', market: 'NASDAQ' },
  { symbol: 'BA', name: 'Boeing', market: 'NYSE' },
];

async function handler() {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from('stock_quotes').select('symbol').eq('is_active', true);
  const existingSet = new Set((existing || []).map((s: any) => s.symbol));
  const existingCount = existingSet.size;

  let added = 0;
  const newStocks: any[] = [];
  const updatedMcap: string[] = [];

  // ═══ 1단계: 하드코딩 필수 종목 확인 + 추가 ═══
  for (const stock of [...MUST_HAVE_KR, ...MUST_HAVE_US]) {
    if (!existingSet.has(stock.symbol)) {
      // 네이버에서 실시간 시세 가져오기
      const quote = stock.market === 'KOSPI' || stock.market === 'KOSDAQ'
        ? await fetchNaverSingle(stock.symbol)
        : null;

      newStocks.push({
        symbol: stock.symbol, name: stock.name, market: stock.market,
        price: quote?.price || 0,
        change_pct: quote?.change_pct || 0, change_amt: 0,
        volume: quote?.volume || 0,
        market_cap: quote?.market_cap || 0,
        currency: stock.market === 'KOSPI' || stock.market === 'KOSDAQ' ? 'KRW' : 'USD',
        is_active: true, updated_at: new Date().toISOString(),
      });
      existingSet.add(stock.symbol);
      await sleep(100);
    }
  }

  // ═══ 2단계: 네이버 시총순 크롤링 (신규 종목 발굴) ═══
  for (const market of ['kospi', 'kosdaq'] as const) {
    const discovered = await fetchNaverMarketCap(market, 2); // 2페이지 = ~100종목
    for (const s of discovered) {
      if (!existingSet.has(s.symbol)) {
        newStocks.push({
          symbol: s.symbol, name: s.name, market: s.market,
          price: s.price, change_pct: s.change_pct, change_amt: 0,
          volume: s.volume, market_cap: s.market_cap,
          currency: 'KRW', is_active: true, updated_at: new Date().toISOString(),
        });
        existingSet.add(s.symbol);
      }
    }
  }

  // ═══ 3단계: 기존 시총 0인 종목 시총 갱신 (네이버 개별 API) ═══
  const { data: zeroMcap } = await sb.from('stock_quotes')
    .select('symbol').eq('is_active', true)
    .in('market', ['KOSPI', 'KOSDAQ'])
    .or('market_cap.is.null,market_cap.eq.0')
    .limit(30);

  for (const s of (zeroMcap || [])) {
    const quote = await fetchNaverSingle(s.symbol);
    if (quote && quote.market_cap > 0) {
      await sb.from('stock_quotes').update({
        market_cap: quote.market_cap,
        ...(quote.price > 0 ? { price: quote.price, change_pct: quote.change_pct, volume: quote.volume } : {}),
        updated_at: new Date().toISOString(),
      }).eq('symbol', s.symbol);
      updatedMcap.push(s.symbol);
    }
    await sleep(80);
  }

  // ═══ 4단계: DB에 새 종목 삽입 ═══
  if (newStocks.length > 0) {
    for (let i = 0; i < newStocks.length; i += 50) {
      const batch = newStocks.slice(i, i + 50);
      const { error } = await sb.from('stock_quotes').upsert(batch, { onConflict: 'symbol', ignoreDuplicates: true });
      if (!error) added += batch.length;
    }
  }

  return {
    processed: existingSet.size,
    created: added,
    updated: updatedMcap.length,
    failed: 0,
    metadata: {
      existing_before: existingCount,
      existing_after: existingSet.size,
      new_added: newStocks.length,
      mcap_updated: updatedMcap.length,
      mcap_symbols: updatedMcap.slice(0, 10),
      new_symbols: newStocks.slice(0, 15).map(s => `${s.symbol}(${s.name})`),
    },
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await withCronLogging('stock-discover', () => handler());
  return NextResponse.json(result);
}
