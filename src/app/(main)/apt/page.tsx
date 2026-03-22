import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '아파트 청약 일정 · 분양중 · 미분양 · 재개발',
  description: '2026년 전국 아파트 청약 일정, 현재 분양중인 아파트, 미분양 현황, 재개발·재건축 진행 현황을 한눈에 확인하세요.',
  openGraph: {
    title: '청약·분양중·미분양·재개발',
    description: '전국 아파트 청약 일정, 분양중 현장, 미분양 현황, 재개발·재건축 진행 현황',
    images: [{ url: 'https://kadeora.app/images/brand/kadeora-full.png', alt: '카더라 청약·분양중·미분양·재개발' }],
  },
};
// Cache: 3600s — 청약 정보 (하루 1회 갱신)
export const revalidate = 3600;
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';
import Disclaimer from '@/components/Disclaimer';

async function fetchAptData() {
  const sb = await createSupabaseServer();
  let apts: any[] = [];
  let unsold: any[] = [];
  let redevelopment: any[] = [];
  let transactions: any[] = [];
  let unsoldSummary: any = null;
  let alertCounts: Record<string, number> = {};
  let lastRefreshed: string | null = null;
  let unsoldMonthly: any[] = [];
  let tradeMonthly: any[] = [];

  try {
    const sb = await createSupabaseServer();

    // Try reading from apt_cache first
    try {
      const { data: cache } = await sb
        .from('apt_cache')
        .select('data, refreshed_at')
        .eq('cache_type', 'apt_subscriptions')
        .maybeSingle();
      if (cache?.data && Array.isArray(cache.data) && cache.data.length > 0) {
        lastRefreshed = cache.refreshed_at;
      }
    } catch {}

    const [aptsR, unsoldR, alertsR, redevelopmentR, unsoldSummaryR, transactionsR, unsoldMonthlyR, tradeMonthlyR] = await Promise.all([
      sb.from('apt_subscriptions').select('id, house_nm, house_manage_no, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, cntrct_cncls_bgnde, cntrct_cncls_endde, spsply_rcept_bgnde, spsply_rcept_endde, mvn_prearnge_ym, pblanc_url, mdatrgbn_nm, competition_rate_1st, competition_rate_2nd, view_count, fetched_at, supply_addr, constructor_nm')
        .or(`rcept_endde.gte.${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},rcept_bgnde.lte.${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`)
        .order('rcept_bgnde', { ascending: false }).limit(1000),
      sb.from('unsold_apts').select('id, house_nm, region_nm, sigungu_nm, tot_supply_hshld_co, tot_unsold_hshld_co, supply_addr, completion_ym, sale_price_min, sale_price_max, pblanc_url, contact_tel, source, created_at, is_active').eq('is_active', true).order('tot_unsold_hshld_co', { ascending: false }),
      sb.from('apt_alerts').select('house_manage_no'),
      sb.from('redevelopment_projects').select('id, district_name, region, sigungu, project_type, stage, area_sqm, total_households, constructor, approval_date, expected_completion, address, notes, summary, is_active, created_at, updated_at, latitude, longitude').eq('is_active', true).order('total_households', { ascending: false }),
      sb.from('apt_cache').select('data').eq('cache_type', 'unsold_summary').maybeSingle(),
      sb.from('apt_transactions').select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type, created_at').gte('deal_date', `${new Date(Date.now() + 9 * 60 * 60 * 1000).getFullYear()}-01-01`).order('deal_date', { ascending: false }).limit(3000),
      sb.from('unsold_monthly_stats').select('stat_month, region, total_unsold, total_after_completion').order('stat_month', { ascending: true }),
      sb.from('apt_trade_monthly_stats').select('stat_month, region, total_deals, avg_price, total_amount').order('stat_month', { ascending: true }),
    ]);
    if (aptsR.data?.length) apts = aptsR.data;
    if (unsoldR.data?.length) unsold = unsoldR.data;
    if (redevelopmentR.data?.length) redevelopment = redevelopmentR.data;
    if (unsoldSummaryR?.data) unsoldSummary = unsoldSummaryR.data;
    if (transactionsR.data?.length) transactions = transactionsR.data;
    if (unsoldMonthlyR.data?.length) unsoldMonthly = unsoldMonthlyR.data;
    if (tradeMonthlyR.data?.length) tradeMonthly = tradeMonthlyR.data;
    (alertsR.data || []).forEach((a: any) => { alertCounts[a.house_manage_no] = (alertCounts[a.house_manage_no] || 0) + 1; });
  } catch {}

  // 지역별 + 상태별 통계 계산
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // KST
  const thisMonth = today.slice(0, 7).replace('-', ''); // KST 기준 YYYYMM // 202603
  const regionDetail: Record<string, { total: number; open: number; upcoming: number; closed: number }> = {};
  apts.forEach((a: any) => {
    const r = a.region_nm || '기타';
    if (!regionDetail[r]) regionDetail[r] = { total: 0, open: 0, upcoming: 0, closed: 0 };
    regionDetail[r].total++;
    if (String(a.rcept_endde ?? '') < today) regionDetail[r].closed++;
    else if (String(a.rcept_bgnde ?? '') <= today) regionDetail[r].open++;
    else regionDetail[r].upcoming++;
  });
  const regionStats = Object.entries(regionDetail).sort((a, b) => b[1].total - a[1].total).map(([name, s]) => ({ name, ...s }));

  // ━━━ 분양중 데이터 조합 ━━━
  // 경쟁률 데이터 (house_manage_no → 경쟁률)
  const competitionMap: Record<string, number> = {};
  apts.forEach((a: any) => {
    if (a.competition_rate_1st) competitionMap[a.house_manage_no] = a.competition_rate_1st;
  });

  // 지역별 평균 실거래가 (만원) 계산
  const regionAvgPrice: Record<string, number> = {};
  const regionTradeCount: Record<string, number> = {};
  transactions.forEach((t: any) => {
    const r = t.region_nm || t.sigungu_nm || '';
    if (!r || !t.deal_amount) return;
    const amt = typeof t.deal_amount === 'string' ? parseInt(t.deal_amount.replace(/,/g, '')) : t.deal_amount;
    if (!amt || amt <= 0) return;
    const regionKey = r.split(' ')[0]; // 시도명만 추출
    if (!regionAvgPrice[regionKey]) { regionAvgPrice[regionKey] = 0; regionTradeCount[regionKey] = 0; }
    regionAvgPrice[regionKey] += amt;
    regionTradeCount[regionKey]++;
  });
  Object.keys(regionAvgPrice).forEach(k => {
    if (regionTradeCount[k] > 0) regionAvgPrice[k] = Math.round(regionAvgPrice[k] / regionTradeCount[k]);
  });

  // 소스1: 청약 마감 + 입주 전 (분양 진행 중)
  const ongoingFromSub = apts
    .filter((a: any) => {
      const endDate = String(a.rcept_endde ?? '');
      if (!endDate || endDate >= today) return false;
      const mvn = String(a.mvn_prearnge_ym ?? '').replace(/[^0-9]/g, '').slice(0, 6);
      if (mvn && mvn < thisMonth) return false;
      return true;
    })
    .map((a: any) => ({
      id: `sub_${a.id}`,
      source: 'subscription' as const,
      house_nm: a.house_nm || '',
      region_nm: a.region_nm || '기타',
      address: a.hssply_adres || a.supply_addr || '',
      total_supply: a.tot_supply_hshld_co || 0,
      unsold_count: null as number | null,
      mvn_prearnge_ym: a.mvn_prearnge_ym || null,
      sale_price_min: null as number | null,
      sale_price_max: null as number | null,
      constructor_nm: a.constructor_nm || a.mdatrgbn_nm || null,
      pblanc_url: a.pblanc_url || null,
      contact_tel: null as string | null,
      link_id: a.id,
      link_type: 'apt' as const,
      created_at: a.fetched_at || a.created_at || null,
      // 강화 필드
      competition_rate: competitionMap[a.house_manage_no] || null,
      rcept_bgnde: a.rcept_bgnde || null,
      rcept_endde: a.rcept_endde || null,
      przwner_presnatn_de: a.przwner_presnatn_de || null,
      cntrct_cncls_bgnde: a.cntrct_cncls_bgnde || null,
      cntrct_cncls_endde: a.cntrct_cncls_endde || null,
      nearby_avg_price: regionAvgPrice[(a.region_nm || '').split(' ')[0]] || null,
    }));

  // 소스2: 미분양 (준공 후 포함)
  // 소스2: 미분양 (개별 단지만 — "OO시 미분양" 같은 시군구 통계는 제외)
  const ongoingFromUnsold = unsold
    .filter((u: any) => !String(u.house_nm || '').endsWith('미분양'))
    .map((u: any) => ({
    id: `unsold_${u.id}`,
    source: 'unsold' as const,
    house_nm: u.house_nm || '',
    region_nm: u.region_nm || '기타',
    address: u.supply_addr || u.hssply_adres || '',
    total_supply: u.tot_supply_hshld_co || 0,
    unsold_count: u.tot_unsold_hshld_co || 0,
    mvn_prearnge_ym: u.completion_ym || null,
    sale_price_min: u.sale_price_min || null,
    sale_price_max: u.sale_price_max || null,
    constructor_nm: null as string | null,
    pblanc_url: u.pblanc_url || null,
    contact_tel: u.contact_tel || null,
    link_id: u.id,
    link_type: 'unsold' as const,
    created_at: u.created_at || null,
    // 강화 필드
    competition_rate: null as number | null,
    rcept_bgnde: null as string | null,
    rcept_endde: null as string | null,
    przwner_presnatn_de: null as string | null,
    cntrct_cncls_bgnde: null as string | null,
    cntrct_cncls_endde: null as string | null,
    nearby_avg_price: regionAvgPrice[(u.region_nm || '').split(' ')[0]] || null,
  }));

  // 중복 제거: 같은 단지명+지역이면 unsold 우선 (미분양 세대수 정보가 더 정확)
  const unsoldNames = new Set(ongoingFromUnsold.map(u => `${u.house_nm}::${u.region_nm}`));
  const dedupedSub = ongoingFromSub.filter(s => !unsoldNames.has(`${s.house_nm}::${s.region_nm}`));
  const ongoingApts = [...ongoingFromUnsold, ...dedupedSub].sort((a, b) => (b.total_supply || 0) - (a.total_supply || 0));

  return { apts, unsold, redevelopment, transactions, unsoldSummary, alertCounts, lastRefreshed, regionStats, unsoldMonthly, tradeMonthly, ongoingApts };
}

export default async function AptPage() {
  const { apts, unsold, redevelopment, transactions, unsoldSummary, alertCounts, lastRefreshed, regionStats, unsoldMonthly, tradeMonthly, ongoingApts } = await fetchAptData();
  return <><AptClient apts={apts} unsold={unsold} redevelopment={redevelopment} transactions={transactions} unsoldSummary={unsoldSummary} alertCounts={alertCounts} lastRefreshed={lastRefreshed} regionStats={regionStats} unsoldMonthly={unsoldMonthly} tradeMonthly={tradeMonthly} ongoingApts={ongoingApts} /><Disclaimer /></>;
}
