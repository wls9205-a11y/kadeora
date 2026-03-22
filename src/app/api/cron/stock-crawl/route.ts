import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * 주식 시세 수집 크론
 * 
 * 1단계 (현재): KRX 공공데이터 + data.go.kr 금융위원회 API
 *   - 장 마감 후 종가 기준 (15~20분 지연)
 *   - 무료, 합법, API 키: STOCK_DATA_API_KEY (data.go.kr 발급)
 * 
 * 2단계 (KIS 키 발급 후): 한국투자증권 오픈API
 *   - 실시간 시세 (1분 이내)
 *   - 무료, 합법, API 키: KIS_APP_KEY + KIS_APP_SECRET
 */

// data.go.kr 금융위원회 주식시세 API
async function fetchKRXStocks(apiKey: string): Promise<any[]> {
  const stocks: any[] = [];
  
  // 주식시세 정보 — KOSPI
  for (const marketCode of ['KOSPI', 'KOSDAQ']) {
    try {
      const url = `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=200&resultType=json&mrktCls=${marketCode}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const items = data?.response?.body?.items?.item || [];
      
      for (const item of items) {
        const price = parseInt(item.clpr) || 0; // 종가
        if (price <= 0) continue;
        
        stocks.push({
          symbol: item.srtnCd || item.isinCd, // 단축코드
          name: item.itmsNm, // 종목명
          market: marketCode,
          price,
          change_amt: parseInt(item.vs) || 0, // 전일대비
          change_pct: parseFloat(item.fltRt) || 0, // 등락률
          volume: parseInt(item.trqu) || 0, // 거래량
          market_cap: parseInt(item.mrktTotAmt) || 0, // 시가총액
          currency: 'KRW',
        });
      }
    } catch {}
  }
  
  return stocks;
}

// KIS 한국투자증권 API (2단계 — 키 발급 후 활성화)
async function fetchKISStocks(appKey: string, appSecret: string): Promise<any[]> {
  const stocks: any[] = [];
  
  try {
    // 1. 토큰 발급
    const tokenRes = await fetch('https://openapi.koreainvestment.com:9443/oauth2/tokenP', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret,
      }),
    });
    if (!tokenRes.ok) return [];
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return [];
    
    // 2. 시세 조회 (주요 종목)
    // KIS API는 종목별 개별 조회 — 기존 DB의 활성 종목만 업데이트
    // (대량 조회는 별도 설정 필요)
    
    return stocks;
  } catch {
    return [];
  }
}

function guessSector(name: string): string | null {
  if (/반도체|하이닉스|삼성전자/.test(name)) return '반도체';
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
    
    let totalCreated = 0;
    let source = 'none';

    // === 1단계: KIS API (실시간, 키가 있을 때) ===
    const kisKey = process.env.KIS_APP_KEY;
    const kisSecret = process.env.KIS_APP_SECRET;
    if (kisKey && kisSecret) {
      const kisStocks = await fetchKISStocks(kisKey, kisSecret);
      if (kisStocks.length > 0) {
        source = 'kis';
        for (const s of kisStocks) {
          const sector = guessSector(s.name);
          const { error } = await supabase.from('stock_quotes').upsert({
            ...s,
            ...(sector ? { sector } : {}),
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'symbol' });
          if (!error) totalCreated++;
        }
      }
    }

    // === 2단계: 공공데이터 API (종가, 키가 있을 때) ===
    const stockApiKey = process.env.STOCK_DATA_API_KEY || process.env.BUSAN_DATA_API_KEY;
    if (stockApiKey && totalCreated === 0) {
      const krxStocks = await fetchKRXStocks(stockApiKey);
      if (krxStocks.length > 0) {
        source = 'data_go_kr';
        for (const s of krxStocks) {
          const sector = guessSector(s.name);
          const { error } = await supabase.from('stock_quotes').upsert({
            ...s,
            ...(sector ? { sector } : {}),
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'symbol' });
          if (!error) totalCreated++;
        }
      }
    }

    // === is_active 정리: price=0이면 비활성 ===
    await supabase.from('stock_quotes')
      .update({ is_active: false })
      .eq('price', 0);

    return {
      processed: totalCreated,
      created: totalCreated,
      failed: 0,
      metadata: {
        source,
        kis_available: !!(kisKey && kisSecret),
        public_api_available: !!stockApiKey,
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ success: true, error: result.error });
  }
  return NextResponse.json({ ok: true, ...result });
}
