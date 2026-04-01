import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const REPORT_REGIONS = [
  '서울','부산','인천','대구','대전','광주','울산','세종',
  '경기','강원','충북','충남','전북','전남','경북','경남','제주',
] as const;

export type ReportRegion = (typeof REPORT_REGIONS)[number];

export interface DailyReportData {
  region: string;
  date: string;
  issueNo: number;
  // 부동산
  subscriptions: { house_nm: string; region_nm: string; tot_supply_hshld_co: number; price_per_pyeong_avg: number | null; rcept_bgnde: string; rcept_endde: string; constructor_nm: string; status: string }[];
  unsoldTotal: number;
  unsoldUnits: number;
  unsoldByRegion: { region_nm: string; cnt: number; units: number }[];
  unsoldLocal: { sigungu: string; units: number }[];
  redevTotal: number;
  redevRebuild: number;
  redevStages: { stage: string; cnt: number }[];
  redevMajor: string[];
  guPrices: { sigungu: string; sale: number; jeonse: number; jeonse_ratio: number; cnt: number; max_sale: number }[];
  complexCount: number;
  sitesCount: number;
  // 주식
  stockTop10: { name: string; symbol: string; market: string; price: number; change_pct: number; market_cap: number; sector: string; week_ago: number | null; week_pct: number | null }[];
  sectors: { sector: string; cnt: number; avg_pct: number; cap_t: number }[];
  globalStocks: { name: string; symbol: string; price: number; market_cap: number; change_pct: number }[];
  // 지수 & 환율
  indices: { label: string; value: number; change_pct: number }[];
  exchangeRate: number;
  // ── 신규: AI 브리핑 ──
  aiBriefing: { market: string; title: string; summary: string; sentiment: string } | null;
  aiBriefingUS: { market: string; title: string; summary: string; sentiment: string } | null;
  // ── 신규: 실거래 동향 ──
  tradeTrend: {
    thisMonth: { deals: number; avgPrice: number; maxPrice: number; maxAptName: string };
    lastMonth: { deals: number; avgPrice: number };
    hotDeals: { apt_name: string; sigungu: string; deal_amount: number; exclusive_area: number; deal_date: string }[];
  } | null;
  // ── 신규: 추천 블로그 ──
  recommendBlogs: { slug: string; title: string; category: string; excerpt: string }[];
  // 메타
  subCountThisWeek: number;
  subUnitsThisWeek: number;
}

// 리포트 호수 계산 (2026-01-06 월요일부터 기준)
function calcIssueNo(date: Date): number {
  const start = new Date('2026-01-06');
  const diff = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const weekdays = Math.floor(diff / 7) * 5 + Math.min(diff % 7, 5);
  return Math.max(1, weekdays);
}

export async function fetchDailyReportData(region: ReportRegion): Promise<DailyReportData> {
  const sb = getSupabaseAdmin();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // sunday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // 병렬 쿼리
  const [
    subsR, unsoldLocalR, unsoldAllR, redevR, redevStagesR, guR, complexR, sitesR,
    stocksR, sectorsR, globalR, subWeekR, indicesR, exchangeR,
    briefingKR, briefingUSR, tradeThisR, tradeLastR, tradeHotR, blogR,
  ] = await Promise.all([
    // 1. 청약 (이번주 ± 3일)
    sb.from('apt_subscriptions')
      .select('house_nm, region_nm, tot_supply_hshld_co, price_per_pyeong_avg, rcept_bgnde, rcept_endde, constructor_nm')
      .gte('rcept_bgnde', new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10))
      .lte('rcept_bgnde', new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10))
      .order('rcept_bgnde', { ascending: true })
      .limit(20),

    // 2. 해당 지역 미분양
    sb.from('unsold_apts')
      .select('sigungu_nm, tot_unsold_hshld_co')
      .eq('region_nm', region).eq('is_active', true)
      .order('tot_unsold_hshld_co', { ascending: false })
      .limit(10),

    // 3. 전국 미분양 지역별
    sb.from('unsold_apts')
      .select('region_nm, tot_unsold_hshld_co')
      .eq('is_active', true),

    // 4. 재개발
    sb.from('redevelopment_projects')
      .select('project_type, stage, district_name')
      .eq('region', region).eq('is_active', true),

    // 5. 재개발 단계별 (RPC 대신 직접)
    sb.from('redevelopment_projects')
      .select('stage')
      .eq('region', region).eq('is_active', true),

    // 6. 구별 시세
    (sb as any).from('apt_complex_profiles')
      .select('sigungu, latest_sale_price, latest_jeonse_price')
      .eq('region_nm', region)
      .gt('latest_sale_price', 0)
      .limit(10000),

    // 7. 단지백과 수
    (sb as any).from('apt_complex_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('region_nm', region),

    // 8. 분양사이트 수
    sb.from('apt_sites')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true).eq('region', region),

    // 9. 주식 시총 TOP 10
    sb.from('stock_quotes')
      .select('name, symbol, market, price, change_pct, market_cap, sector, volume')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .gt('price', 0)
      .order('market_cap', { ascending: false })
      .limit(10),

    // 10. 섹터 — 별도 쿼리 불가하므로 전체 가져와서 JS에서 집계
    sb.from('stock_quotes')
      .select('sector, change_pct, market_cap')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .gt('price', 0)
      .not('sector', 'is', null)
      .limit(2000),

    // 11. 글로벌
    sb.from('stock_quotes')
      .select('name, symbol, price, market_cap, change_pct')
      .in('market', ['NYSE', 'NASDAQ'])
      .gt('price', 0)
      .order('market_cap', { ascending: false })
      .limit(6),

    // 12. 이번주 청약 수
    sb.from('apt_subscriptions')
      .select('tot_supply_hshld_co')
      .gte('rcept_bgnde', weekStart.toISOString().slice(0, 10))
      .lte('rcept_bgnde', weekEnd.toISOString().slice(0, 10)),

    // 13. 지수 (KOSPI/KOSDAQ/SPY/QQQ)
    sb.from('stock_quotes')
      .select('symbol, name, price, change_pct')
      .in('symbol', ['KOSPI_IDX', 'KOSDAQ_IDX', 'SPY', 'QQQ'])
      .limit(4),

    // 14. 환율
    sb.from('exchange_rate_history')
      .select('rate')
      .eq('currency_pair', 'USD/KRW')
      .order('recorded_at', { ascending: false })
      .limit(1),

    // ── 신규 15: AI 브리핑 (국내) ──
    sb.from('stock_daily_briefing')
      .select('market, title, summary, sentiment')
      .eq('market', 'KR')
      .order('briefing_date', { ascending: false })
      .limit(1),

    // ── 신규 16: AI 브리핑 (해외) ──
    sb.from('stock_daily_briefing')
      .select('market, title, summary, sentiment')
      .eq('market', 'US')
      .order('briefing_date', { ascending: false })
      .limit(1),

    // ── 신규 17: 이번 달 실거래 (해당 지역) ──
    sb.from('apt_transactions')
      .select('apt_name, sigungu, deal_amount, exclusive_area, deal_date')
      .eq('region_nm', region)
      .gte('deal_date', `${dateStr.slice(0, 7)}-01`)
      .order('deal_date', { ascending: false })
      .limit(1000),

    // ── 신규 18: 지난 달 실거래 (해당 지역) ──
    (() => {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return sb.from('apt_transactions')
        .select('deal_amount')
        .eq('region_nm', region)
        .gte('deal_date', lastMonth.toISOString().slice(0, 10))
        .lte('deal_date', lastEnd.toISOString().slice(0, 10))
        .limit(5000);
    })(),

    // ── 신규 19: 최근 고가 거래 (핫딜) ──
    sb.from('apt_transactions')
      .select('apt_name, sigungu, deal_amount, exclusive_area, deal_date')
      .eq('region_nm', region)
      .gte('deal_date', new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10))
      .order('deal_amount', { ascending: false })
      .limit(5),

    // ── 신규 20: 추천 블로그 ──
    sb.from('blog_posts')
      .select('slug, title, category, excerpt')
      .eq('is_published', true)
      .not('published_at', 'is', null)
      .lte('published_at', now.toISOString())
      .order('published_at', { ascending: false })
      .limit(3),
  ]);

  // 청약 상태 계산
  const subs = (subsR.data || []).map((s: any) => ({
    ...s,
    status: s.rcept_bgnde > dateStr ? '예정' : s.rcept_endde >= dateStr ? '접수중' : '마감',
  }));

  // 전국 미분양 집계
  const unsoldAllData = unsoldAllR.data || [];
  const unsoldMap = new Map<string, { cnt: number; units: number }>();
  unsoldAllData.forEach((r: any) => {
    const existing = unsoldMap.get(r.region_nm) || { cnt: 0, units: 0 };
    unsoldMap.set(r.region_nm, { cnt: existing.cnt + 1, units: existing.units + (r.tot_unsold_hshld_co || 0) });
  });
  const unsoldByRegion = Array.from(unsoldMap.entries()).map(([k, v]) => ({ region_nm: k, ...v })).sort((a, b) => b.units - a.units);

  const unsoldTotal = unsoldByRegion.reduce((s, r) => s + r.cnt, 0);
  const unsoldUnits = unsoldByRegion.reduce((s, r) => s + r.units, 0);

  // 재개발 집계
  const redevData = redevR.data || [];
  const redevTotal = redevData.length;
  const redevRebuild = redevData.filter((r: any) => r.project_type === '재건축').length;
  const redevMajor = redevData.filter((r: any) => r.project_type === '재건축').map((r: any) => r.district_name).slice(0, 10);

  // 단계별 집계
  const stageMap = new Map<string, number>();
  (redevStagesR.data || []).forEach((r: any) => stageMap.set(r.stage, (stageMap.get(r.stage) || 0) + 1));
  const stageOrder = ['정비구역지정', '조합설립', '사업시행인가', '관리처분', '착공', '준공'];
  const redevStages = stageOrder
    .filter(s => stageMap.has(s))
    .map(s => ({ stage: s, cnt: stageMap.get(s) || 0 }));

  // 구별 시세 집계
  const guMap = new Map<string, { total_sale: number; total_jeonse: number; cnt: number; max_sale: number }>();
  (guR.data || []).forEach((r: any) => {
    const existing = guMap.get(r.sigungu) || { total_sale: 0, total_jeonse: 0, cnt: 0, max_sale: 0 };
    guMap.set(r.sigungu, {
      total_sale: existing.total_sale + r.latest_sale_price,
      total_jeonse: existing.total_jeonse + (r.latest_jeonse_price || 0),
      cnt: existing.cnt + 1,
      max_sale: Math.max(existing.max_sale, r.latest_sale_price),
    });
  });
  const guPrices = Array.from(guMap.entries()).map(([k, v]) => {
    const sale = Math.round(v.total_sale / v.cnt);
    const jeonse = Math.round(v.total_jeonse / v.cnt);
    return { sigungu: k, sale, jeonse, jeonse_ratio: sale > 0 ? Math.round(jeonse * 100 / sale) : 0, cnt: v.cnt, max_sale: v.max_sale };
  }).sort((a, b) => b.sale - a.sale);

  // 섹터 집계
  const sectorMap = new Map<string, { total_pct: number; total_cap: number; cnt: number }>();
  (sectorsR.data || []).forEach((r: any) => {
    if (!r.sector || Math.abs(r.change_pct) > 30) return;
    const existing = sectorMap.get(r.sector) || { total_pct: 0, total_cap: 0, cnt: 0 };
    sectorMap.set(r.sector, {
      total_pct: existing.total_pct + (r.change_pct || 0),
      total_cap: existing.total_cap + (r.market_cap || 0),
      cnt: existing.cnt + 1,
    });
  });
  const sectors = Array.from(sectorMap.entries())
    .filter(([_, v]) => v.cnt >= 3 && v.total_cap > 5e12)
    .map(([k, v]) => ({
      sector: k,
      cnt: v.cnt,
      avg_pct: Math.round(v.total_pct / v.cnt * 100) / 100,
      cap_t: Math.round(v.total_cap / 1e12),
    }))
    .sort((a, b) => b.avg_pct - a.avg_pct);

  // 주식 TOP 10 + 주간 변동 (별도 쿼리)
  const stockTop10: DailyReportData['stockTop10'] = [];
  for (const s of (stocksR.data || []).slice(0, 10)) {
    const { data: histData } = await sb.from('stock_price_history')
      .select('close_price')
      .eq('symbol', s.symbol)
      .order('date', { ascending: false })
      .range(4, 4);
    const weekAgo = histData?.[0]?.close_price ?? null;
    const weekPct = weekAgo && weekAgo > 0 ? Math.round(((Number(s.price) - weekAgo) / weekAgo) * 10000) / 100 : null;
    stockTop10.push({
      name: s.name, symbol: s.symbol, market: s.market,
      price: Number(s.price), change_pct: Number(s.change_pct || 0),
      market_cap: s.market_cap ?? 0, sector: s.sector || '',
      week_ago: weekAgo ? Number(weekAgo) : null, week_pct: weekPct,
    });
  }

  // 이번주 청약 집계
  const subWeekData = subWeekR.data || [];
  const subCountThisWeek = subWeekData.length;
  const subUnitsThisWeek = subWeekData.reduce((s: number, r: any) => s + (r.tot_supply_hshld_co || 0), 0);

  // ── 신규: AI 브리핑 ──
  const briefingKRData = briefingKR.data?.[0] || null;
  const briefingUSData = briefingUSR.data?.[0] || null;
  const aiBriefing = briefingKRData ? { market: 'KR', title: briefingKRData.title, summary: briefingKRData.summary, sentiment: briefingKRData.sentiment || 'neutral' } : null;
  const aiBriefingUS = briefingUSData ? { market: 'US', title: briefingUSData.title, summary: briefingUSData.summary, sentiment: briefingUSData.sentiment || 'neutral' } : null;

  // ── 신규: 실거래 동향 ──
  const tradeThisData = tradeThisR.data || [];
  const tradeLastData = tradeLastR.data || [];
  let tradeTrend: DailyReportData['tradeTrend'] = null;
  if (tradeThisData.length > 0) {
    const thisAmounts = tradeThisData.map((r: any) => Number(r.deal_amount));
    const lastAmounts = tradeLastData.map((r: any) => Number(r.deal_amount));
    const maxIdx = thisAmounts.indexOf(Math.max(...thisAmounts));
    tradeTrend = {
      thisMonth: {
        deals: tradeThisData.length,
        avgPrice: Math.round(thisAmounts.reduce((a: number, b: number) => a + b, 0) / thisAmounts.length),
        maxPrice: thisAmounts[maxIdx] || 0,
        maxAptName: tradeThisData[maxIdx]?.apt_name || '',
      },
      lastMonth: {
        deals: tradeLastData.length,
        avgPrice: lastAmounts.length > 0 ? Math.round(lastAmounts.reduce((a: number, b: number) => a + b, 0) / lastAmounts.length) : 0,
      },
      hotDeals: (tradeHotR.data || []).slice(0, 5).map((r: any) => ({
        apt_name: r.apt_name, sigungu: r.sigungu, deal_amount: Number(r.deal_amount),
        exclusive_area: Number(r.exclusive_area), deal_date: r.deal_date,
      })),
    };
  }

  // ── 신규: 추천 블로그 ──
  const recommendBlogs = (blogR.data || []).map((r: any) => ({
    slug: r.slug, title: r.title, category: r.category || 'general', excerpt: (r.excerpt || '').slice(0, 80),
  }));

  return {
    region,
    date: dateStr,
    issueNo: calcIssueNo(now),
    subscriptions: subs,
    unsoldTotal,
    unsoldUnits,
    unsoldByRegion,
    unsoldLocal: (unsoldLocalR.data || []).map((r: any) => ({ sigungu: r.sigungu_nm, units: r.tot_unsold_hshld_co })),
    redevTotal,
    redevRebuild,
    redevStages,
    redevMajor,
    guPrices,
    complexCount: complexR.count || 0,
    sitesCount: sitesR.count || 0,
    stockTop10,
    sectors,
    globalStocks: (globalR.data || []).map((r: any) => ({
      name: r.name, symbol: r.symbol, price: Number(r.price), market_cap: r.market_cap, change_pct: Number(r.change_pct || 0),
    })),
    indices: (indicesR.data || []).map((r: any) => {
      const labelMap: Record<string, string> = { KOSPI_IDX: 'KOSPI', KOSDAQ_IDX: 'KOSDAQ', SPY: 'S&P 500', QQQ: 'NASDAQ' };
      return { label: labelMap[r.symbol] || r.symbol, value: Number(r.price), change_pct: Number(r.change_pct || 0) };
    }),
    exchangeRate: Number(exchangeR.data?.[0]?.rate || 0),
    aiBriefing,
    aiBriefingUS,
    tradeTrend,
    recommendBlogs,
    subCountThisWeek,
    subUnitsThisWeek,
  };
}
