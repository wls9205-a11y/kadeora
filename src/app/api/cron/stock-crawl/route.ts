import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

// 네이버 금융 시세 페이지에서 종목 데이터 파싱
async function fetchNaverStocks(market: 'KOSPI' | 'KOSDAQ', pages: number = 3): Promise<any[]> {
  const stocks: any[] = [];
  const marketCode = market === 'KOSPI' ? 0 : 1;

  for (let page = 1; page <= pages; page++) {
    try {
      // 네이버 금융 시가총액 순 정렬
      const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${marketCode}&page=${page}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kadeora/1.0)' },
      });
      const html = await res.text();

      // 간단한 HTML 파싱 — <a href="/item/main.naver?code=XXXXXX"> 패턴
      const rowRegex = /href="\/item\/main\.naver\?code=(\d{6})"[^>]*>\s*([^<]+)<\/a>[\s\S]*?<td class="number">([\d,]+)<\/td>\s*<td class="number">\s*<span[^>]*>([\d,]+)<\/span>/g;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const symbol = match[1];
        const name = match[2].trim();
        const price = parseInt(match[3].replace(/,/g, ''));
        const changePriceStr = match[4].replace(/,/g, '');

        if (price > 0 && name) {
          stocks.push({ symbol, name, market, price });
        }
      }

      // 더 간단한 패턴: tltle 클래스에서 종목명+코드 추출
      if (stocks.length === 0) {
        const simpleRegex = /code=(\d{6})"[^>]*class="tltle"[^>]*>([^<]+)/g;
        while ((match = simpleRegex.exec(html)) !== null) {
          stocks.push({ symbol: match[1], name: match[2].trim(), market, price: 0 });
        }
      }
    } catch {}
  }

  return stocks;
}

// Yahoo Finance에서 미국 종목 시세 가져오기
async function fetchUSStocks(): Promise<any[]> {
  const symbols = [
    // S&P 500 상위 + 인기 종목
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'JPM', 'V',
    'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'HD', 'AVGO', 'COST', 'ABBV', 'MRK',
    'CRM', 'AMD', 'NFLX', 'PEP', 'KO', 'LLY', 'TMO', 'ADBE', 'WMT', 'BAC',
    'CSCO', 'ACN', 'MCD', 'ABT', 'DHR', 'TXN', 'NEE', 'PM', 'INTC', 'QCOM',
    'AMAT', 'BKNG', 'ISRG', 'AMGN', 'GE', 'CAT', 'LRCX', 'BA', 'PFE', 'DIS',
    // 추가 인기
    'PLTR', 'COIN', 'RIVN', 'LCID', 'SOFI', 'NIO', 'MARA', 'SMCI', 'ARM', 'SNOW',
    'SQ', 'SHOP', 'ROKU', 'DDOG', 'ZS', 'CRWD', 'PANW', 'MDB', 'NET', 'ABNB',
  ];

  const stocks: any[] = [];
  // Yahoo Finance API (비공식이지만 무료)
  try {
    const symbolStr = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolStr}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kadeora/1.0)' },
    });
    if (res.ok) {
      const data = await res.json();
      const quotes = data?.quoteResponse?.result || [];
      for (const q of quotes) {
        if (q.regularMarketPrice > 0) {
          stocks.push({
            symbol: q.symbol,
            name: q.shortName || q.longName || q.symbol,
            market: q.exchange === 'NMS' ? 'NASDAQ' : 'NYSE',
            price: q.regularMarketPrice,
            change_amt: q.regularMarketChange || 0,
            change_pct: q.regularMarketChangePercent || 0,
            volume: q.regularMarketVolume || 0,
            market_cap: q.marketCap || 0,
            currency: 'USD',
          });
        }
      }
    }
  } catch {}
  return stocks;
}

function guessSector(name: string): string | null {
  if (/반도체|하이닉스|삼성전자|마이크론|엔비디아/.test(name)) return '반도체';
  if (/바이오|셀트리온|삼성바이오|유한양행|녹십자|한미약품/.test(name)) return '바이오';
  if (/금융|은행|지주|보험|증권|KB|신한|하나|우리|NH/.test(name)) return '금융';
  if (/자동차|현대차|기아|만도|한온/.test(name)) return '자동차';
  if (/배터리|에너지|SDI|에코프로|포스코퓨처/.test(name)) return '2차전지';
  if (/건설|대우|GS건설|현대건설|삼성물산/.test(name)) return '건설';
  if (/통신|SKT|KT |LG유플러스/.test(name)) return '통신';
  if (/카카오|네이버|플랫폼|엔씨소프트|크래프톤/.test(name)) return 'IT/소프트웨어';
  if (/화학|LG화학|롯데케미칼|한화솔루션/.test(name)) return '화학';
  if (/방산|한화에어|LIG넥스원|현대로템/.test(name)) return '방산';
  if (/미디어|CJ ENM|스튜디오|하이브|SM|JYP|YG/.test(name)) return '미디어';
  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-crawl', async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 1. 미국 주식 (Yahoo Finance)
    const usStocks = await fetchUSStocks();
    let usCreated = 0;
    for (const s of usStocks) {
      const { error } = await supabase.from('stock_quotes').upsert({
        symbol: s.symbol,
        name: s.name,
        market: s.market,
        price: s.price,
        change_amt: s.change_amt,
        change_pct: s.change_pct,
        volume: s.volume,
        market_cap: s.market_cap,
        currency: s.currency,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'symbol' });
      if (!error) usCreated++;
    }

    // 2. 한국 주식 — 기존 종목 시세 업데이트 (네이버)
    // 네이버 증권 개별 종목 API로 기존 종목 시세 갱신
    const { data: existingKR } = await supabase.from('stock_quotes')
      .select('symbol')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .eq('is_active', true);

    let krUpdated = 0;
    if (existingKR) {
      for (let i = 0; i < existingKR.length; i += 20) {
        const batch = existingKR.slice(i, i + 20);
        await Promise.allSettled(batch.map(async (s) => {
          try {
            const url = `https://finance.naver.com/item/main.naver?code=${s.symbol}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await res.text();
            // 현재가 파싱
            const priceMatch = html.match(/no_today[\s\S]*?<span class="blind">([\d,]+)<\/span>/);
            if (priceMatch) {
              const price = parseInt(priceMatch[1].replace(/,/g, ''));
              if (price > 0) {
                await supabase.from('stock_quotes').update({
                  price,
                  updated_at: new Date().toISOString(),
                }).eq('symbol', s.symbol);
                krUpdated++;
              }
            }
          } catch {}
        }));
      }
    }

    return {
      processed: usStocks.length + (existingKR?.length || 0),
      created: usCreated + krUpdated,
      failed: 0,
      metadata: {
        us_stocks: usStocks.length,
        us_created: usCreated,
        kr_updated: krUpdated,
        kr_total: existingKR?.length || 0,
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ success: true, error: result.error });
  }
  return NextResponse.json({ ok: true, ...result });
}
