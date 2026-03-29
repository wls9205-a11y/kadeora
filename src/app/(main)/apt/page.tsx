import { Suspense } from 'react';
import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';

const APT_SECTION_META: Record<string, { title: string; desc: string }> = {
  'apt-region':       { title: '전국 부동산 현황', desc: '지역별 청약·분양·미분양·재개발 현황을 한눈에' },
  'apt-calendar':     { title: '이번 달 청약 캘린더', desc: '접수중·예정 청약 일정 모아보기' },
  'apt-subscription': { title: '전국 청약 현황', desc: '접수중·예정·마감 전국 아파트 청약 정보' },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ section?: string }> }): Promise<Metadata> {
  const { section } = await searchParams;
  const s = section ? APT_SECTION_META[section] : null;
  const title = s?.title || '아파트 청약 일정 · 분양중 · 미분양 · 재개발';
  const desc = s?.desc || '2026년 전국 아파트 청약 일정, 현재 분양중인 아파트, 미분양 현황, 재개발·재건축 진행 현황을 한눈에 확인하세요. 실시간 경쟁률, 실거래가 분석까지.';
  const ogImg = section ? `${SITE_URL}/api/og?section=${section}&design=2` : `${SITE_URL}/api/og?title=${encodeURIComponent('아파트 청약·분양·재개발')}&subtitle=${encodeURIComponent('전국 실시간 현황')}`;

  return {
    title, description: desc,
    alternates: { canonical: SITE_URL + '/apt' },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title, description: desc,
      url: SITE_URL + '/apt', siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: ogImg, width: 1200, height: 630, alt: `카더라 ${title}` }],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogImg] },
    other: { 'article:section': '부동산', 'naver:written_time': '2026-01-15T00:00:00Z', 'naver:updated_time': new Date().toISOString(), 'naver:author': '카더라', 'og:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/apt' },
  };
}
// Cache: 3600s — 청약 정보 (하루 1회 갱신)
export const revalidate = 3600;
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';
import Disclaimer from '@/components/Disclaimer';

async function fetchAllRows(sb: any, table: string, select: string, filter?: (q: any) => any) {
  const rows: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    let q = sb.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 50000) break;
  }
  return rows;
}

async function fetchAptData() {
  let apts: Record<string, any>[] = [];
  let unsold: Record<string, any>[] = [];
  const alertCounts: Record<string, number> = {};
  let lastRefreshed: string | null = null;
  let redevTotalCount = 0;
  let tradeTotalCount = 0;
  let redevelopment: Record<string, any>[] = [];
  let transactions: Record<string, any>[] = [];
  const regionAvgPriceMap: Record<string, number> = {};

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

    // SSR: 청약 + 미분양(ongoingApts 생성용) + 알림 카운트만 로드
    // 실거래/재개발/월별통계는 클라이언트에서 탭 클릭 시 lazy fetch
    const [aptsR, unsoldR, alertsR, redevCountR, tradeCountR] = await Promise.all([
      sb.from('apt_subscriptions').select('id, house_nm, house_manage_no, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, cntrct_cncls_bgnde, cntrct_cncls_endde, spsply_rcept_bgnde, spsply_rcept_endde, mvn_prearnge_ym, pblanc_url, mdatrgbn_nm, competition_rate_1st, competition_rate_2nd, view_count, fetched_at, supply_addr, constructor_nm, is_price_limit, ai_summary')
        .or(`rcept_endde.gte.${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},rcept_bgnde.lte.${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`)
        .order('rcept_bgnde', { ascending: false }).limit(1000),
      sb.from('unsold_apts').select('id, house_nm, region_nm, sigungu_nm, tot_supply_hshld_co, tot_unsold_hshld_co, supply_addr, completion_ym, sale_price_min, sale_price_max, pblanc_url, contact_tel, source, created_at, is_active').eq('is_active', true).order('tot_unsold_hshld_co', { ascending: false }),
      sb.from('apt_alerts').select('house_manage_no'),
      sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
      sb.from('apt_transactions').select('id', { count: 'exact', head: true }),
    ]);
    if (aptsR.data?.length) apts = aptsR.data;
    if (unsoldR.data?.length) unsold = unsoldR.data;
    (alertsR.data || []).forEach((a: Record<string, any>) => { alertCounts[a.house_manage_no] = (alertCounts[a.house_manage_no] || 0) + 1; });
    redevTotalCount = redevCountR.count ?? 0;
    tradeTotalCount = tradeCountR.count ?? 0;

    // 페이지네이션으로 전체 행 수집 (Supabase max_rows=1000 우회)
    [redevelopment, transactions] = await Promise.all([
      fetchAllRows(sb, 'redevelopment_projects', 'id, region', (q: any) => q.eq('is_active', true)),
      fetchAllRows(sb, 'apt_transactions', 'id, region_nm'),
    ]);

    // 지역별 평균가 (분양중 단지에 주입)
    try {
      const { data: tradeStats } = await sb.from('apt_trade_monthly_stats')
        .select('region, avg_price')
        .order('stat_month', { ascending: false })
        .limit(50);
      (tradeStats || []).forEach((s: any) => {
        if (s.region && s.avg_price && !regionAvgPriceMap[s.region]) {
          regionAvgPriceMap[s.region] = Number(s.avg_price);
        }
      });
    } catch {}
  } catch {}

  // 지역별 + 상태별 통계 계산
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // KST
  const thisMonth = today.slice(0, 7).replace('-', ''); // KST 기준 YYYYMM // 202603
  const normalizeRegion = (name: string) => name.replace(/특별시|광역시|특별자치시|특별자치도|도$/, '').trim();
  const regionDetail: Record<string, { total: number; open: number; upcoming: number; closed: number }> = {};
  apts.forEach((a: Record<string, any>) => {
    const r = normalizeRegion(a.region_nm || '') || '기타';
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
  apts.forEach((a: Record<string, any>) => {
    if (a.competition_rate_1st) competitionMap[a.house_manage_no] = a.competition_rate_1st;
  });

  // 소스1: 청약 마감 + 입주 전 (분양 진행 중)
  const ongoingFromSub = apts
    .filter((a: Record<string, any>) => {
      const endDate = String(a.rcept_endde ?? '');
      if (!endDate || endDate >= today) return false;
      const mvn = String(a.mvn_prearnge_ym ?? '').replace(/[^0-9]/g, '').slice(0, 6);
      if (mvn && mvn < thisMonth) return false;
      return true;
    })
    .map((a: Record<string, any>) => ({
      id: `sub_${a.id}`,
      source: 'subscription' as const,
      house_nm: a.house_nm || '',
      region_nm: normalizeRegion(a.region_nm || '') || '기타',
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
      nearby_avg_price: regionAvgPriceMap[normalizeRegion(a.region_nm || '')] || null,
    }));

  // 소스2: 미분양 (준공 후 포함)
  // 소스2: 미분양 (개별 단지만 — "OO시 미분양" 같은 시군구 통계는 제외)
  const ongoingFromUnsold = unsold
    .filter((u: any) => !String(u.house_nm || '').endsWith('미분양'))
    .map((u: any) => ({
    id: `unsold_${u.id}`,
    source: 'unsold' as const,
    house_nm: u.house_nm || '',
    region_nm: normalizeRegion(u.region_nm || '') || '기타',
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
    nearby_avg_price: regionAvgPriceMap[normalizeRegion(u.region_nm || '')] || null,
  }));

  // 중복 제거: 같은 단지명+지역이면 unsold 우선 (미분양 세대수 정보가 더 정확)
  const unsoldNames = new Set(ongoingFromUnsold.map(u => `${u.house_nm}::${u.region_nm}`));
  const dedupedSub = ongoingFromSub.filter(s => !unsoldNames.has(`${s.house_nm}::${s.region_nm}`));
  const ongoingApts = [...ongoingFromUnsold, ...dedupedSub].sort((a, b) => (b.total_supply || 0) - (a.total_supply || 0));

  return { apts, unsold, alertCounts, lastRefreshed, regionStats, ongoingApts, redevTotalCount, tradeTotalCount, redevelopment, transactions };
}

export default async function AptPage() {
  const { apts, unsold, alertCounts, lastRefreshed, regionStats, ongoingApts, redevTotalCount, tradeTotalCount, redevelopment, transactions } = await fetchAptData();
  // ItemList for Google carousel rich results
  const itemList = apts.slice(0, 10).map((a: any, i: number) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: a.house_nm,
    url: `${SITE_URL}/apt/${encodeURIComponent(a.house_nm?.trim().replace(/\s+/g, '-').replace(/[^\w가-힣\-]/g, '').toLowerCase() || a.house_manage_no || a.id)}`,
  }));

  return <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>부동산 정보를 불러오는 중...</div>}>
    {/* BreadcrumbList */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"카더라","item":SITE_URL},{"@type":"ListItem","position":2,"name":"부동산","item":SITE_URL + "/apt"}]}) }} />
    {/* ItemList → Google carousel */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"ItemList","name":"전국 아파트 청약 일정","numberOfItems":apts.length,"itemListElement":itemList}) }} />
    {/* CollectionPage → search engine context */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"아파트 청약·분양·미분양·재개발","description":`전국 ${apts.length}건 청약, ${ongoingApts.length}건 분양중, ${unsold.length}건 미분양 현황`,"url":SITE_URL+"/apt","isPartOf":{"@type":"WebSite","name":"카더라","url":SITE_URL}}) }} />
    <AptClient apts={apts} unsold={unsold} redevelopment={redevelopment} transactions={transactions} alertCounts={alertCounts} lastRefreshed={lastRefreshed} regionStats={regionStats} ongoingApts={ongoingApts} redevTotalCount={redevTotalCount} tradeTotalCount={tradeTotalCount} />
    <Disclaimer />
  </Suspense>;
}
