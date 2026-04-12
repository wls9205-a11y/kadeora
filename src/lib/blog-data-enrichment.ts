/**
 * 블로그 실데이터 주입 시스템 v1.0
 * "데이터가 없으면 발행하지 않는다" 원칙의 핵심 모듈
 * 
 * apt_complex_profiles (34,537건) + apt_transactions (497,413건) +
 * stock_quotes (1,846건) + stock_price_history (41,996건) 활용
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

// ── APT 단지 분석용 데이터 ──

export interface AptEnrichment {
  complex: {
    apt_name: string;
    region_nm: string;
    sigungu: string;
    dong: string;
    built_year: number | null;
    total_households: number | null;
    latest_sale_price: number | null;
    latest_sale_date: string | null;
    avg_sale_price_pyeong: number | null;
    latest_jeonse_price: number | null;
    jeonse_ratio: number | null;
    price_change_1y: number | null;
    sale_count_1y: number | null;
    rent_count_1y: number | null;
  };
  recentTrades: { date: string; area: number; floor: number; price: number }[];
  comparables: { name: string; price_pyeong: number | null; built_year: number | null; households: number | null }[];
  contextualLinks: string[];
}

export async function enrichAptData(aptName: string, sigungu?: string): Promise<AptEnrichment | null> {
  const admin = getSupabaseAdmin();

  // 1. 단지 프로필 조회
  let q = (admin as any).from('apt_complex_profiles').select('*').eq('apt_name', aptName);
  if (sigungu) q = q.eq('sigungu', sigungu);
  const { data: complex } = await q.limit(1).maybeSingle();
  if (!complex) return null;

  // 2. 최근 실거래 3건
  const { data: trades } = await (admin as any).from('apt_transactions')
    .select('deal_date, area, floor, price')
    .eq('apt_name', aptName)
    .order('deal_date', { ascending: false })
    .limit(3);

  // 3. 같은 지역 비교 단지 3곳
  const { data: comps } = await (admin as any).from('apt_complex_profiles')
    .select('apt_name, avg_sale_price_pyeong, built_year, total_households')
    .eq('dong', complex.dong || complex.sigungu)
    .neq('apt_name', aptName)
    .not('avg_sale_price_pyeong', 'is', null)
    .order('total_households', { ascending: false })
    .limit(3);

  // 4. 컨텍스트 내부 링크
  const { data: nearbyPages } = await (admin as any).from('apt_sites')
    .select('slug, name')
    .eq('sigungu', complex.sigungu)
    .neq('name', aptName)
    .limit(3);

  const contextualLinks = [
    ...(nearbyPages || []).map((p: any) => `[${p.name} 분석 →](/apt/sites/${p.slug})`),
    '[청약 가점 계산 →](/apt/diagnose)',
    '[취득세 계산기 →](/calc/real-estate/acquisition-tax)',
    '[전체 청약 일정 →](/apt)',
    `[${complex.sigungu} 미분양 현황 →](/apt?tab=unsold)`,
    '[카더라 부동산 블로그 →](/blog?category=apt)',
    '[커뮤니티 토론 →](/feed)',
  ];

  return {
    complex: {
      apt_name: complex.apt_name,
      region_nm: complex.region_nm || '',
      sigungu: complex.sigungu || '',
      dong: complex.dong || '',
      built_year: complex.built_year,
      total_households: complex.total_households,
      latest_sale_price: complex.latest_sale_price,
      latest_sale_date: complex.latest_sale_date,
      avg_sale_price_pyeong: complex.avg_sale_price_pyeong,
      latest_jeonse_price: complex.latest_jeonse_price,
      jeonse_ratio: complex.jeonse_ratio,
      price_change_1y: complex.price_change_1y,
      sale_count_1y: complex.sale_count_1y,
      rent_count_1y: complex.rent_count_1y,
    },
    recentTrades: (trades || []).map((t: any) => ({
      date: t.deal_date,
      area: t.area,
      floor: t.floor,
      price: t.price,
    })),
    comparables: (comps || []).map((c: any) => ({
      name: c.apt_name,
      price_pyeong: c.avg_sale_price_pyeong,
      built_year: c.built_year,
      households: c.total_households,
    })),
    contextualLinks,
  };
}

/**
 * APT 데이터를 프롬프트용 텍스트로 변환
 */
export function formatAptDataForPrompt(data: AptEnrichment): string {
  const c = data.complex;
  const age = c.built_year ? new Date().getFullYear() - c.built_year : null;

  let prompt = `## 반드시 포함할 실데이터:\n`;
  prompt += `- 단지명: ${c.apt_name}\n`;
  prompt += `- 위치: ${c.region_nm} ${c.sigungu} ${c.dong}\n`;
  if (c.built_year) prompt += `- 입주년도: ${c.built_year}년 (${age}년차)\n`;
  if (c.total_households) prompt += `- 세대수: ${c.total_households}세대\n`;
  if (c.latest_sale_price) prompt += `- 최근 매매가: ${c.latest_sale_price}만원 (${c.latest_sale_date || '최근'})\n`;
  if (c.avg_sale_price_pyeong) prompt += `- 평당가: ${c.avg_sale_price_pyeong}만원/3.3㎡\n`;
  if (c.latest_jeonse_price) prompt += `- 최근 전세가: ${c.latest_jeonse_price}만원\n`;
  if (c.jeonse_ratio) prompt += `- 전세가율: ${c.jeonse_ratio}%\n`;
  if (c.price_change_1y !== null) prompt += `- 1년 변동률: ${c.price_change_1y > 0 ? '+' : ''}${c.price_change_1y}%\n`;
  if (c.sale_count_1y) prompt += `- 1년 매매 거래: ${c.sale_count_1y}건\n`;
  if (c.rent_count_1y) prompt += `- 1년 임대 거래: ${c.rent_count_1y}건\n`;

  if (data.recentTrades.length > 0) {
    prompt += `\n## 최근 실거래 이력:\n`;
    prompt += `| 거래일 | 전용면적(㎡) | 층 | 거래가(만원) |\n|---|---|---|---|\n`;
    data.recentTrades.forEach(t => {
      prompt += `| ${t.date} | ${t.area} | ${t.floor}층 | ${t.price.toLocaleString()} |\n`;
    });
  }

  if (data.comparables.length > 0) {
    prompt += `\n## 같은 지역 비교 단지:\n`;
    prompt += `| 단지명 | 평당가(만원) | 입주년도 | 세대수 |\n|---|---|---|---|\n`;
    data.comparables.forEach(comp => {
      prompt += `| ${comp.name} | ${comp.price_pyeong ?? '-'} | ${comp.built_year ?? '-'} | ${comp.households ?? '-'} |\n`;
    });
  }

  prompt += `\n## 내부 링크 (본문에 자연스럽게 5개 이상 삽입):\n`;
  data.contextualLinks.forEach(link => { prompt += `- ${link}\n`; });

  return prompt;
}

// ── STOCK 종목 분석용 데이터 ──

export interface StockEnrichment {
  quote: {
    name: string;
    symbol: string;
    market: string;
    price: number;
    change_pct: number;
    market_cap: number | null;
    per: number | null;
    pbr: number | null;
    dividend_yield: number | null;
    currency: string;
  };
  priceHistory: number[];
  sectorPeers: { name: string; symbol: string; price: number; change_pct: number }[];
  contextualLinks: string[];
}

export async function enrichStockData(symbol: string): Promise<StockEnrichment | null> {
  const admin = getSupabaseAdmin();

  const { data: quote } = await (admin as any).from('stock_quotes')
    .select('*')
    .eq('symbol', symbol)
    .maybeSingle();
  if (!quote) return null;

  const { data: history } = await (admin as any).from('stock_price_history')
    .select('close_price')
    .eq('symbol', symbol)
    .order('date', { ascending: false })
    .limit(20);

  const { data: peers } = await (admin as any).from('stock_quotes')
    .select('name, symbol, price, change_pct')
    .eq('market', quote.market)
    .neq('symbol', symbol)
    .order('market_cap', { ascending: false })
    .limit(5);

  const contextualLinks = [
    `[${quote.name} 실시간 차트 →](/stock/${symbol})`,
    '[종합 시세 →](/stock)',
    '[종목 비교 →](/stock/compare)',
    '[투자 커뮤니티 →](/feed?category=stock)',
    '[카더라 주식 블로그 →](/blog?category=stock)',
  ];

  return {
    quote: {
      name: quote.name,
      symbol: quote.symbol,
      market: quote.market,
      price: quote.price,
      change_pct: quote.change_pct,
      market_cap: quote.market_cap,
      per: quote.per,
      pbr: quote.pbr,
      dividend_yield: quote.dividend_yield,
      currency: quote.currency || 'KRW',
    },
    priceHistory: (history || []).map((h: any) => h.close_price),
    sectorPeers: (peers || []).map((p: any) => ({
      name: p.name, symbol: p.symbol, price: p.price, change_pct: p.change_pct,
    })),
    contextualLinks,
  };
}

export function formatStockDataForPrompt(data: StockEnrichment): string {
  const q = data.quote;
  let prompt = `## 반드시 포함할 실데이터:\n`;
  prompt += `- 종목명: ${q.name} (${q.symbol})\n`;
  prompt += `- 시장: ${q.market}\n`;
  prompt += `- 현재가: ${q.price.toLocaleString()}${q.currency === 'USD' ? '달러' : '원'}\n`;
  prompt += `- 등락률: ${q.change_pct > 0 ? '+' : ''}${q.change_pct}%\n`;
  if (q.market_cap) prompt += `- 시가총액: ${q.market_cap.toLocaleString()}${q.currency === 'USD' ? '달러' : '원'}\n`;
  if (q.per) prompt += `- PER: ${q.per}배\n`;
  if (q.pbr) prompt += `- PBR: ${q.pbr}배\n`;
  // 배당: 실데이터만. null이면 미배당 명시
  prompt += `- 배당수익률: ${q.dividend_yield !== null && q.dividend_yield > 0 ? q.dividend_yield + '%' : '미배당 또는 데이터 미제공 (절대 추정 배당률 생성 금지)'}\n`;

  if (data.sectorPeers.length > 0) {
    prompt += `\n## 같은 시장 비교 종목:\n`;
    prompt += `| 종목 | 현재가 | 등락률 |\n|---|---|---|\n`;
    data.sectorPeers.slice(0, 3).forEach(p => {
      prompt += `| ${p.name}(${p.symbol}) | ${p.price.toLocaleString()} | ${p.change_pct > 0 ? '+' : ''}${p.change_pct}% |\n`;
    });
  }

  prompt += `\n## 내부 링크 (본문에 자연스럽게 5개 이상 삽입):\n`;
  data.contextualLinks.forEach(link => { prompt += `- ${link}\n`; });

  return prompt;
}

// ── 블로그 글에서 단지명/종목명 추출 ──

export function extractAptName(title: string): { name: string; sigungu?: string } | null {
  // "장락주공2단지 청약 분석 — 충북 입지..." → "장락주공2단지"
  const match = title.match(/^(.+?)(?:\s+(?:청약|실거래|분양|미분양|재개발|완전|시세|투자))/);
  if (match) return { name: match[1].trim() };
  // "서울 강남구 개포주공1단지 완전 분석" → "개포주공1단지", sigungu: "강남구"
  const match2 = title.match(/(?:서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|경북|경남|전북|전남|제주)\s+(\S+구|\S+시|\S+군)\s+(.+?)(?:\s+완전|\s+분석)/);
  if (match2) return { name: match2[2].trim(), sigungu: match2[1] };
  return null;
}

export function extractStockSymbol(title: string, slug: string): string | null {
  // "SK하이닉스 (000660) 주가 분석" → "000660"
  const match = title.match(/\(([A-Z0-9]{2,10})\)/);
  if (match) return match[1];
  // slug: "stock-analysis-000660-2026" → "000660"
  const slugMatch = slug.match(/stock-(?:analysis|deep)-([A-Z0-9]+)/i);
  if (slugMatch) return slugMatch[1];
  return null;
}
