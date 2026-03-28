import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 120;

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
async function fetchKRXStocks(apiKey: string): Promise<{ stocks: any[]; debug: string }> {
  const stocks: Record<string, any>[] = [];
  const debugLines: string[] = [];
  
  for (const marketCode of ['KOSPI', 'KOSDAQ']) {
    let pageNo = 1;
    const numOfRows = 100; // 디버그용 소량 먼저
    
    try {
      const url = `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=${numOfRows}&pageNo=${pageNo}&resultType=json&mrktCls=${marketCode}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const httpStatus = res.status;
      const rawText = await res.text();
      debugLines.push(`[${marketCode}] HTTP ${httpStatus} | len=${rawText.length} | preview=${rawText.slice(0, 200)}`);
      
      if (!res.ok) { debugLines.push(`[${marketCode}] HTTP 오류: ${httpStatus}`); continue; }
      
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        debugLines.push(`[${marketCode}] JSON 파싱 실패: ${String(e).slice(0, 100)}`);
        continue;
      }
      
      // 응답 구조 확인
      const resultCode = data?.response?.header?.resultCode;
      const resultMsg = data?.response?.header?.resultMsg;
      debugLines.push(`[${marketCode}] resultCode=${resultCode} msg=${resultMsg}`);
      
      const items = data?.response?.body?.items?.item || [];
      const totalCount = data?.response?.body?.totalCount || 0;
      debugLines.push(`[${marketCode}] items=${Array.isArray(items) ? items.length : typeof items} totalCount=${totalCount}`);
      
      const itemArr = Array.isArray(items) ? items : (items ? [items] : []);
      for (const item of itemArr) {
        const price = parseInt(item.clpr) || 0;
        if (price <= 0) continue;
        stocks.push({
          symbol: item.srtnCd || item.isinCd,
          name: item.itmsNm,
          market: marketCode,
          price,
          change_amt: parseInt(item.vs) || 0,
          change_pct: parseFloat(item.fltRt) || 0,
          volume: parseInt(item.trqu) || 0,
          market_cap: parseInt(item.mrktTotAmt) || 0,
          currency: 'KRW',
        });
      }
      
      // 페이지 추가 수집 (정상이면)
      if (itemArr.length >= numOfRows && totalCount > numOfRows) {
        let pg = 2;
        const fullRows = 1000;
        while (pg * fullRows <= totalCount + fullRows) {
          try {
            const u2 = `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=${fullRows}&pageNo=${pg}&resultType=json&mrktCls=${marketCode}`;
            const r2 = await fetch(u2, { signal: AbortSignal.timeout(15000) });
            if (!r2.ok) break;
            const d2 = await r2.json();
            const it2 = d2?.response?.body?.items?.item || [];
            const arr2 = Array.isArray(it2) ? it2 : (it2 ? [it2] : []);
            if (!arr2.length) break;
            for (const item of arr2) {
              const price = parseInt(item.clpr) || 0;
              if (price <= 0) continue;
              stocks.push({ symbol: item.srtnCd || item.isinCd, name: item.itmsNm, market: marketCode, price, change_amt: parseInt(item.vs)||0, change_pct: parseFloat(item.fltRt)||0, volume: parseInt(item.trqu)||0, market_cap: parseInt(item.mrktTotAmt)||0, currency: 'KRW' });
            }
            if (arr2.length < fullRows) break;
            pg++;
          } catch { break; }
        }
      }
    } catch (e) {
      debugLines.push(`[${marketCode}] 예외: ${String(e).slice(0, 200)}`);
    }
  }
  
  return { stocks, debug: debugLines.join(' | ') };
}

// KIS 한국투자증권 API (2단계 — 키 발급 후 활성화)
async function fetchKISStocks(appKey: string, appSecret: string): Promise<any[]> {
  const stocks: Record<string, any>[] = [];
  
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
  if (/반도체|하이닉스|삼성전자|DB하이텍|리노공업|원익IPS|한미반도체|이오테크닉스|테스|주성엔지니어링|피에스케이|솔브레인|동진쎄미켐|티씨케이|ISC/.test(name)) return '반도체';
  if (/바이오|셀트리온|삼성바이오|유한양행|녹십자|한미약품|대웅|종근당|일양|JW|보령|동아에스티|SK바이오|에이비엘|메디톡스|오스코텍|헬릭스미스|제넥신|알테오젠|레고켐|씨젠|에스디바이오|파미셀|차바이오|코오롱생명|HK이노엔|CJ제일제당/.test(name)) return '바이오';
  if (/금융|은행|지주|보험|증권|KB|신한|하나|우리|NH|메리츠|미래에셋|키움|삼성생명|삼성화재|한화생명|현대해상|DB손해|한국금융|카드|캐피탈|BNK|DGB|JB|iM/.test(name)) return '금융';
  if (/자동차|현대차|기아|만도|한온|현대모비스|에스엘|화신|덴소|HL만도|계양전기/.test(name)) return '자동차';
  if (/배터리|에너지솔루션|SDI|에코프로|포스코퓨처|엘앤에프|코스모신소재|일진머티리얼즈|천보|2차전지|SK이노베이션|SK온/.test(name)) return '2차전지';
  if (/건설|대림|GS건설|현대건설|삼성물산|HDC|DL이앤씨|태영|한신공영|계룡|금호|대우건설|코오롱글로벌/.test(name)) return '건설';
  if (/통신|SKT|SK텔레콤|KT |KT&G|LG유플러스|SK스퀘어/.test(name)) return '통신';
  if (/카카오|네이버|엔씨소프트|크래프톤|넷마블|컴투스|위메이드|펄어비스|데브시스터즈|NHN|더존비즈온|한글과컴퓨터|카페24|두나무|토스|비바리퍼블리카/.test(name)) return 'IT/소프트웨어';
  if (/화학|LG화학|롯데케미칼|한화솔루션|금호석유|OCI|SKC|효성|대한유화|SK케미칼|코오롱인더/.test(name)) return '화학';
  if (/방산|한화에어|LIG넥스원|현대로템|한국항공|풍산|한화시스템|LIG/.test(name)) return '방산';
  if (/미디어|CJ ENM|스튜디오|하이브|SM엔터|JYP|YG|위지윅|덱스터|카카오엔터|콘텐트리/.test(name)) return '미디어';
  if (/철강|포스코|현대제철|동국제강|세아|고려아연|풍산홀딩스/.test(name)) return '철강';
  if (/유틸리티|한국전력|한전KPS|한국가스|지역난방|서울가스|SK가스/.test(name)) return '유틸리티';
  if (/식품|오리온|농심|CJ|롯데|풀무원|삼양|오뚜기|하이트진로|빙그레|매일|남양/.test(name)) return '소비재';
  if (/호텔|신라|롯데관광|하나투어|모두투어|교원|이랜드|신세계|현대백화점|롯데쇼핑|GS리테일|BGF/.test(name)) return '소비재';
  if (/해운|항공|대한항공|아시아나|HMM|팬오션|흥아해운|한진칼/.test(name)) return '운송';
  if (/조선|한국조선|HD현대|삼성중공업|대우조선|HD한국조선해양/.test(name)) return '조선';
  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-crawl', async () => {
    const supabase = getSupabaseAdmin();
    
    let totalCreated = 0;
    let source = 'none';

    // === 1단계: KIS API (실시간, 키가 있을 때) ===
    const kisKey = process.env.KIS_APP_KEY;
    const kisSecret = process.env.KIS_APP_SECRET;
    if (kisKey && kisSecret) {
      const kisStocks = await fetchKISStocks(kisKey, kisSecret);
      if (kisStocks.length > 0) {
        source = 'kis';
        const now = new Date().toISOString();
        for (let i = 0; i < kisStocks.length; i += 100) {
          const batch = kisStocks.slice(i, i + 100).map(s => ({
            ...s,
            sector: guessSector(s.name) || undefined,
            is_active: true,
            updated_at: now,
          }));
          const { error } = await supabase.from('stock_quotes').upsert(batch, { onConflict: 'symbol' });
          if (!error) totalCreated += batch.length;
        }
      }
    }

    // === 2단계: 공공데이터 API (종가, 키가 있을 때) ===
    const stockApiKey = process.env.STOCK_DATA_API_KEY || process.env.BUSAN_DATA_API_KEY;
    let krxDebug = '';
    if (stockApiKey && totalCreated === 0) {
      const { stocks: krxStocks, debug } = await fetchKRXStocks(stockApiKey);
      krxDebug = debug;
      if (krxStocks.length > 0) {
        source = 'data_go_kr';
        const now = new Date().toISOString();
        for (let i = 0; i < krxStocks.length; i += 100) {
          const batch = krxStocks.slice(i, i + 100).map(s => ({
            ...s,
            sector: guessSector(s.name) || undefined,
            is_active: true,
            updated_at: now,
          }));
          const { error } = await supabase.from('stock_quotes').upsert(batch, { onConflict: 'symbol' });
          if (!error) totalCreated += batch.length;
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
        krx_debug: krxDebug.slice(0, 800),
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ success: true, error: result.error });
  }
  return NextResponse.json({ ok: true, ...result });
}
