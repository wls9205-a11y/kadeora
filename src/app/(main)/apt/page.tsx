import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';

async function TopBuilders() {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('apt_sites').select('builder').eq('is_active', true).not('builder', 'is', null).neq('builder', '');
    const map = new Map<string, number>();
    for (const r of (data || [])) { if (r.builder) map.set(r.builder, (map.get(r.builder) || 0) + 1); }
    const top = Array.from(map.entries()).filter(([, c]) => c >= 5).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (top.length === 0) return null;
    const shortName = (s: string) => s.replace(/\(주\)|주식회사| /g, '').slice(0, 12);
    return (
      <section style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>주요 건설사</h2>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {top.map(([b, c]) => (
            <Link key={b} href={`/apt/builder/${encodeURIComponent(b)}`} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, textDecoration: 'none', fontWeight: 600, background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{shortName(b)} ({c})</Link>
          ))}
        </div>
      </section>
    );
  } catch { return null; }
}

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
      images: [
        { url: ogImg, width: 1200, height: 630, alt: `카더라 ${title}` },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('부동산')}&category=apt`, width: 630, height: 630, alt: `카더라 ${title}` },
      ],
    },
    twitter: { card: 'summary_large_image', title, description: desc, images: [ogImg] },
    other: { 'article:section': '부동산', 'article:tag': '부동산,청약,분양,미분양,재개발,실거래가,아파트', 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'naver:author': '카더라', 'og:updated_time': new Date().toISOString(), 'dg:plink': SITE_URL + '/apt' },
  };
}
// Cache: 3600s — 청약 정보 (하루 1회 갱신)
export const revalidate = 60;
export const maxDuration = 30;
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';
import Disclaimer from '@/components/Disclaimer';
import AptHubCuration from '@/components/apt/AptHubCuration';
import PriceBandFilter from '@/components/apt/PriceBandFilter';
import HeroCard from '@/components/ui/HeroCard';
import { getSupabaseAdmin as getSbAdminForHero } from '@/lib/supabase-admin';

const LIFECYCLE_KO: Record<string, string> = {
  pre_announcement: '분양 예고',
  model_house_open: '모델하우스',
  subscription_open: '청약 진행',
  special_supply: '특별공급',
  contract: '계약',
  construction: '시공',
  pre_move_in: '입주 예정',
  move_in: '입주',
  resale: '실거래',
  site_planning: '부지계획',
};

async function fetchHero() {
  try {
    const sb = getSbAdminForHero();
    const { data } = await (sb as any).from('v_apt_today_pick')
      .select('slug,name,site_type,lifecycle_stage,region,sigungu,dong,popularity_score,total_units,builder')
      .order('rank', { ascending: true }).limit(1).maybeSingle();
    return (data ?? null) as Record<string, any> | null;
  } catch { return null; }
}

async function fetchAptData() {
  let apts: Record<string, any>[] = [];
  let unsold: Record<string, any>[] = [];
  const alertCounts: Record<string, number> = {};
  let lastRefreshed: string | null = null;
  let redevTotalCount = 0;
  let tradeTotalCount = 0;
  let subTotalCount = 0;
  let redevRedevCount = 0;
  let redevRebuildCount = 0;
  let unsoldTotalCount = 0;
  let ongoingTotalCount = 0;
  let dataFreshness = { sub: '', trade: '', unsold: '', redev: '' };
  let tradeByRegion: Record<string, number> = {};
  let redevByRegion: Record<string, number> = {};
  const regionAvgPriceMap: Record<string, number> = {};
  // 세션 138: SSR 카드 렌더용 초기 30건 (unsold/redev/trade URL 진입 시 img 포함)
  let initialTransactions: any[] = [];
  let initialRedevelopment: any[] = [];

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

    // SSR: 청약 + 미분양 + 알림 카운트 + 지역별 실거래/재개발 건수
    const [aptsR, unsoldR, alertsR, redevCountR, tradeByRegionR, redevByRegionR, subCountR, unsoldCountR, ongoingCountR, redevRedevR, redevRebuildR] = await Promise.all([
      sb.from('apt_subscriptions').select('id, house_nm, house_manage_no, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, cntrct_cncls_bgnde, cntrct_cncls_endde, spsply_rcept_bgnde, spsply_rcept_endde, mvn_prearnge_ym, pblanc_url, mdatrgbn_nm, competition_rate_1st, competition_rate_2nd, view_count, fetched_at, supply_addr, constructor_nm, is_price_limit, ai_summary, house_type_info, price_per_pyeong_avg, developer_nm, general_supply_total, special_supply_total, move_in_month, brand_name, is_regulated_area, announcement_pdf_url, loan_rate, project_type, total_households, payment_schedule, community_facilities, heating_type, parking_ratio, balcony_extension, acquisition_tax_est, down_payment_pct, transfer_limit_years')
        .or(`rcept_endde.gte.${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},rcept_bgnde.lte.${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`)
        .order('rcept_bgnde', { ascending: false }).limit(300),
      sb.from('unsold_apts').select('id, house_nm, region_nm, sigungu_nm, tot_supply_hshld_co, tot_unsold_hshld_co, supply_addr, completion_ym, sale_price_min, sale_price_max, pblanc_url, contact_tel, source, created_at, is_active, constructor_nm, developer_nm, discount_info, nearest_station, price_per_pyeong, ai_summary').eq('is_active', true).order('tot_unsold_hshld_co', { ascending: false }),
      sb.from('apt_alerts').select('house_manage_no'),
      sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
      (sb as any).rpc('get_trade_count_by_region'),
      (sb as any).rpc('get_redev_count_by_region'),
      // 정확한 카운트 (도넛 차트용)
      sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
      sb.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      sb.from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('status', 'ongoing'),
      sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('project_type', '재개발'),
      sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('project_type', '재건축'),
    ]);

    // 세션 138: SSR 카드 렌더용 초기 30건 (unsold/redev/trade 탭 URL 진입 시 img 포함)
    const [initTxR, initRedevR] = await Promise.all([
      sb.from('apt_transactions')
        .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type, created_at')
        .gte('deal_date', `${new Date().getFullYear()}-01-01`)
        .order('deal_date', { ascending: false }).limit(30),
      sb.from('redevelopment_projects')
        .select('id, district_name, region, sigungu, stage, total_households, constructor, developer, address, latitude, longitude, nearest_station, is_active, project_type, expected_completion, estimated_move_in, approval_date, area_sqm, notes, key_features, summary, ai_summary, max_floor, total_dong, floor_area_ratio, building_coverage, land_area, transfer_limit')
        .eq('is_active', true).order('total_households', { ascending: false }).limit(30),
    ]);
    initialTransactions = initTxR.data || [];
    initialRedevelopment = initRedevR.data || [];
    // 데이터 수집일 조회 (별도 — 실패해도 무시)
    try {
      const [subFreshR, tradeFreshR, unsoldFreshR, redevFreshR] = await Promise.all([
        sb.from('apt_subscriptions').select('fetched_at').order('fetched_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('apt_transactions').select('deal_date').order('deal_date', { ascending: false }).limit(1).maybeSingle(),
        sb.from('unsold_apts').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('redevelopment_projects').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      dataFreshness = {
        sub: subFreshR.data?.fetched_at ? new Date(subFreshR.data.fetched_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : '',
        trade: tradeFreshR.data?.deal_date ? new Date(tradeFreshR.data.deal_date + 'T00:00:00+09:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }) : '',
        unsold: unsoldFreshR.data?.created_at ? new Date(unsoldFreshR.data.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }) : '',
        redev: redevFreshR.data?.updated_at ? new Date(redevFreshR.data.updated_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }) : '',
      };
    } catch {}
    if (aptsR.data?.length) apts = aptsR.data;
    if (unsoldR.data?.length) unsold = unsoldR.data;
    (alertsR.data || []).forEach((a: Record<string, any>) => { alertCounts[a.house_manage_no] = (alertCounts[a.house_manage_no] || 0) + 1; });
    redevTotalCount = redevCountR.count ?? 0;
    subTotalCount = subCountR.count ?? 0;
    unsoldTotalCount = unsoldCountR.count ?? 0;
    ongoingTotalCount = ongoingCountR.count ?? 0;
    redevRedevCount = redevRedevR.count ?? 0;
    redevRebuildCount = redevRebuildR.count ?? 0;
    // 실거래 총 건수 — RPC 지역별 합산
    (tradeByRegionR.data || []).forEach((r: any) => { if (r.region) { tradeByRegion[r.region] = Number(r.trade_count) || 0; tradeTotalCount += Number(r.trade_count) || 0; } });
    (redevByRegionR.data || []).forEach((r: any) => { if (r.region) redevByRegion[r.region] = Number(r.redev_count) || 0; });

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

  // ━━━ 현장 이미지 맵 (apt_sites + apt_complex_profiles → 카드 썸네일용) ━━━
  // 세션 142 마감: PostgREST 1000 row cap 으로 34K row 조회 잘려 매칭 누락 → 0 외부 CDN URL
  // → 실제 apts/unsold house_nm set 으로 타깃 in() 조회 (payload ↓, 매칭율 ↑)
  let aptImageMap: Record<string, string> = {};
  let aptEngageMap: Record<string, { views: number; comments: number; interest: number }> = {};
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const adminSb = getSupabaseAdmin();
    const neededNames = Array.from(new Set([
      ...apts.map((a: any) => a.house_nm).filter(Boolean),
      ...unsold.map((u: any) => u.house_nm).filter(Boolean),
    ])) as string[];
    // s163: PostgREST .in() 큰 배열 URL 한계 우회 — chunked batch (50/query)
    const { pickRealImage, pickBestAptImage, batchedInQuery } = await import('@/lib/aptImage');
    const APT_SITE_COLS = 'name, satellite_image_url, images, og_image_url, page_views, comment_count, interest_count';

    let sitesData: any[] = [];
    let complexData: any[] = [];
    if (neededNames.length > 0) {
      sitesData = await batchedInQuery<any>(
        async (chunk) => (adminSb as any).from('apt_sites').select(APT_SITE_COLS).in('name', chunk),
        neededNames,
        50,
      );
      complexData = await batchedInQuery<any>(
        async (chunk) => (adminSb as any).from('apt_complex_profiles').select('apt_name, images').in('apt_name', chunk).not('images', 'is', null),
        neededNames,
        50,
      );
    } else {
      const [sitesRes, complexRes] = await Promise.all([
        (adminSb as any).from('apt_sites').select(APT_SITE_COLS).limit(2000),
        (adminSb as any).from('apt_complex_profiles').select('apt_name, images').not('images', 'is', null).limit(2000),
      ]);
      sitesData = (sitesRes.data as any[]) || [];
      complexData = (complexRes.data as any[]) || [];
    }

    // 1순위: apt_complex_profiles 에서 real image (OG 필터)
    for (const row of complexData) {
      const real = pickRealImage(row.images);
      if (real) aptImageMap[row.apt_name] = real;
    }
    // 2순위: apt_sites — satellite > real images > 외부 CDN og_image_url > /api/og 제네릭
    for (const row of sitesData) {
      const picked = pickBestAptImage(row);
      if (picked) aptImageMap[row.name] = picked;
      if (row.page_views > 0 || row.comment_count > 0 || row.interest_count > 0) {
        aptEngageMap[row.name] = { views: row.page_views || 0, comments: row.comment_count || 0, interest: row.interest_count || 0 };
      }
    }
  } catch {}

  // 지역별 + 상태별 통계 계산
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // KST
  const thisMonth = today.slice(0, 7).replace('-', ''); // KST 기준 YYYYMM // 202603
  const normalizeRegion = (name: string) => name.replace(/특별시|광역시|특별자치시|특별자치도|도$|시$/, '').trim();
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
    .map((a: Record<string, any>) => {
      // house_type_info에서 분양가 추출
      const hti = Array.isArray(a.house_type_info) ? a.house_type_info : [];
      const amounts = hti.map((t: any) => t.lttot_top_amount).filter((v: any) => v > 0);
      const minAmounts = hti.map((t: any) => t.lttot_min_amount || t.lttot_top_amount).filter((v: any) => v > 0);
      const extractedMax = amounts.length > 0 ? Math.max(...amounts) : null;
      const extractedMin = minAmounts.length > 0 ? Math.min(...minAmounts) : null;
      return {
      id: `sub_${a.id}`,
      source: 'subscription' as const,
      house_nm: a.house_nm || '',
      region_nm: normalizeRegion(a.region_nm || '') || '기타',
      total_supply: a.tot_supply_hshld_co || 0,
      house_type_info: a.house_type_info || null,
      unsold_count: null as number | null,
      mvn_prearnge_ym: a.mvn_prearnge_ym || null,
      sale_price_min: extractedMin,
      sale_price_max: extractedMax,
      constructor_nm: a.constructor_nm || a.mdatrgbn_nm || null,
      pblanc_url: a.pblanc_url || null,
      contact_tel: null as string | null,
      link_id: a.id,
      link_type: 'apt' as const,
      created_at: a.fetched_at || a.created_at || null,
      // 강화 필드
      competition_rate: competitionMap[a.house_manage_no] || a.competition_rate_1st || null,
      rcept_bgnde: a.rcept_bgnde || null,
      rcept_endde: a.rcept_endde || null,
      przwner_presnatn_de: a.przwner_presnatn_de || null,
      cntrct_cncls_bgnde: a.cntrct_cncls_bgnde || null,
      cntrct_cncls_endde: a.cntrct_cncls_endde || null,
      nearby_avg_price: regionAvgPriceMap[normalizeRegion(a.region_nm || '')] || null,
      // PDF 파싱 + 데이터 강화 필드
      price_per_pyeong_avg: a.price_per_pyeong_avg || null,
      acquisition_tax_est: a.acquisition_tax_est || null,
      down_payment_pct: a.down_payment_pct || null,
      general_supply_total: a.general_supply_total || null,
      special_supply_total: a.special_supply_total || null,
      brand_name: a.brand_name || null,
      project_type: a.project_type || null,
      developer_nm: a.developer_nm || null,
      loan_rate: a.loan_rate || null,
      is_regulated_area: a.is_regulated_area || false,
      total_households: a.total_households || null,
      transfer_limit_years: a.transfer_limit_years || null,
      address: a.hssply_adres || a.supply_addr || '',
    };
    });

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

  return { apts, unsold, alertCounts, lastRefreshed, regionStats, ongoingApts, redevTotalCount, tradeTotalCount, tradeByRegion, redevByRegion, subTotalCount, unsoldTotalCount, ongoingTotalCount, dataFreshness, redevRedevCount, redevRebuildCount, aptImageMap, aptEngageMap, initialTransactions, initialRedevelopment };
}

export default async function AptPage({ searchParams }: { searchParams?: Promise<{ price?: string }> }) {
  const sp = (await searchParams) || {};
  const activePriceBand = typeof sp.price === 'string' ? sp.price : null;
  const [aptData, hero] = await Promise.all([fetchAptData(), fetchHero()]);
  const { apts, unsold, alertCounts, lastRefreshed, regionStats, ongoingApts, redevTotalCount, tradeTotalCount, tradeByRegion, redevByRegion, subTotalCount, unsoldTotalCount, ongoingTotalCount, dataFreshness, redevRedevCount, redevRebuildCount, aptImageMap, aptEngageMap, initialTransactions, initialRedevelopment } = aptData;
  // ItemList for Google carousel rich results
  const itemList = apts.slice(0, 10).map((a: any, i: number) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: a.house_nm,
    image: aptImageMap[a.house_nm] || `${SITE_URL}/api/og?title=${encodeURIComponent(a.house_nm || "")}&design=2&category=apt`,
    url: `${SITE_URL}/apt/${encodeURIComponent(a.house_nm?.trim().replace(/\s+/g, '-').replace(/[^\w가-힣\-]/g, '').toLowerCase() || a.house_manage_no || a.id)}`,
  }));

  // Suspense 제거 — async server component (AptHubCuration) 는 inline await 가능,
  // outer Suspense 는 RightPanel/SectionShareButton 의 dynamic({ssr:false}) bailout 과
  // 함께 $RS replace race 를 발생시켜 production 에서 parentNode null TypeError 를 던짐.
  return <>
    {/* BreadcrumbList */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"카더라","item":SITE_URL},{"@type":"ListItem","position":2,"name":"부동산","item":SITE_URL + "/apt"}]}) }} />
    {/* ItemList → Google carousel */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"ItemList","name":"전국 아파트 청약 일정","numberOfItems":apts.length,"itemListElement":itemList}) }} />
    {/* CollectionPage → search engine context */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"아파트 청약·분양·미분양·재개발","description":`전국 ${apts.length}건 청약, ${ongoingApts.length}건 분양중, ${unsold.length}건 미분양 현황`,"url":SITE_URL+"/apt","isPartOf":{"@type":"WebSite","name":"카더라","url":SITE_URL}}) }} />
    {/* FAQPage — 포털 노출 면적 확대 */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"아파트 청약 일정은 어디서 확인하나요?","acceptedAnswer":{"@type":"Answer","text":"카더라(kadeora.app)에서 전국 아파트 청약 일정, 경쟁률, 분양가, 입주 예정일을 실시간으로 확인할 수 있습니다. 지역별·상태별 필터링도 지원합니다."}},{"@type":"Question","name":"미분양 아파트 현황은 어떻게 확인하나요?","acceptedAnswer":{"@type":"Answer","text":`현재 전국 ${unsold.length}개 단지가 미분양 상태입니다. 카더라 부동산 페이지에서 지역별 미분양 세대수, 분양가, 연락처를 확인할 수 있습니다.`}},{"@type":"Question","name":"분양중인 아파트는 몇 개인가요?","acceptedAnswer":{"@type":"Answer","text":`현재 ${ongoingApts.length}개 단지가 분양 진행 중입니다. 각 단지별 분양가, 시공사, 위치 정보를 카더라에서 비교할 수 있습니다.`}}]}) }} />
    {/* speakable */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"WebPage","name":"부동산 — 청약·분양·미분양·재개발","speakable":{"@type":"SpeakableSpecification","cssSelector":["h1",".region-summary"]}}) }} />
    <h1 className="sr-only">부동산 — 청약·분양·미분양·재개발</h1>
    <p className="sr-only">카더라 부동산에서는 전국 {apts.length}건의 아파트 청약 일정, {ongoingApts.length}건의 분양 현장, {unsold.length}건의 미분양 단지, {redevTotalCount}건의 재개발·재건축 정보를 실시간으로 제공합니다. 지역별·타입별 필터로 원하는 부동산 정보를 빠르게 찾을 수 있으며, 분양가·입주 예정일·경쟁률·시세 비교를 무료로 확인할 수 있습니다.</p>
    {/* Phase 9: 오늘의 추천 hero — v_apt_today_pick rank=1. LiveBar 는 (main)/layout 의 LiveBarChrome 으로 통합. */}
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {/* */}
      {hero && (
        <HeroCard
          tag="오늘의 추천"
          title={hero.name}
          meta={[
            hero.lifecycle_stage ? LIFECYCLE_KO[hero.lifecycle_stage] || hero.lifecycle_stage : null,
            [hero.region, hero.sigungu, hero.dong].filter(Boolean).join(' '),
            hero.builder,
            hero.total_units ? `${Number(hero.total_units).toLocaleString()}세대` : null,
          ].filter(Boolean).join(' · ')}
          stats={[
            ...(hero.lifecycle_stage ? [{ value: LIFECYCLE_KO[hero.lifecycle_stage] || hero.lifecycle_stage, label: '단계' }] : []),
            ...(hero.total_units ? [{ value: Number(hero.total_units).toLocaleString(), label: '세대수' }] : []),
            ...(hero.popularity_score && hero.popularity_score !== 100 ? [{ value: `★ ${hero.popularity_score}`, label: '인기', tone: 'success' as const }] : []),
          ]}
          href={`/apt/${encodeURIComponent(hero.slug)}`}
        />
      )}
    </div>
    {/* Phase 8: 가격대 필터 pill (5 단계) */}
    <PriceBandFilter active={activePriceBand} />
    {/* Phase 7 A: 메인 hub 큐레이션 (4 섹션 + 분류 nav + 시공사/시도) */}
    <AptHubCuration />
    <AptClient apts={apts} unsold={unsold} transactions={initialTransactions} redevelopment={initialRedevelopment} alertCounts={alertCounts} lastRefreshed={lastRefreshed} regionStats={regionStats} ongoingApts={ongoingApts} redevTotalCount={redevTotalCount} tradeTotalCount={tradeTotalCount} tradeByRegion={tradeByRegion} redevByRegion={redevByRegion} subTotalCount={subTotalCount} unsoldTotalCount={unsoldTotalCount} ongoingTotalCount={ongoingTotalCount} dataFreshness={dataFreshness} redevRedevCount={redevRedevCount} redevRebuildCount={redevRebuildCount} aptImageMap={aptImageMap} aptEngageMap={aptEngageMap} />
    {/* C-7: noscript — JS 비활성화 크롤러용 기본 청약 목록 */}
    <noscript>
      <div style={{ padding: 20 }}>
        <h2>전국 아파트 청약 일정</h2>
        <ul>
          {apts.slice(0, 20).map((a: any) => (
            <li key={a.id || a.house_nm}><a href={`/apt/${encodeURIComponent(a.house_nm?.trim().replace(/\s+/g, '-').replace(/[^\w가-힣\-]/g, '').toLowerCase() || a.id)}`}>{a.house_nm} — {a.region_nm} {a.tot_supply_hshld_co}세대</a></li>
          ))}
        </ul>
      </div>
    </noscript>

    {/* SEO 허브 내부 링크 — 크롤 심도 + PageRank 분배 */}
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg) var(--sp-lg)' }}>
      <section style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>지역별 아파트 시세</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['서울','경기','부산','대구','인천','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => (
            <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{ padding: '5px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{r}</Link>
          ))}
        </div>
      </section>
      <section style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>테마별 분석</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { s: 'price-up', l: '📈 가격 상승' }, { s: 'price-down', l: '📉 가격 하락' },
            { s: 'low-jeonse-ratio', l: '🛡️ 전세가율↓' }, { s: 'high-jeonse-ratio', l: '⚠️ 전세가율↑' },
            { s: 'new-built', l: '🏗️ 신축' }, { s: 'high-trade', l: '🔥 거래활발' },
          ].map(t => (
            <Link key={t.s} href={`/apt/theme/${t.s}`} style={{ padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>{t.l}</Link>
          ))}
        </div>
      </section>
      <section style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>부동산 도구</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/apt/complex" style={{ padding: '5px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>📊 단지백과 34,537</Link>
          <Link href="/apt/search" style={{ padding: '5px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>🔍 실거래 검색</Link>
          <Link href="/apt/diagnose" style={{ padding: '5px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>📋 청약 진단</Link>
          <Link href="/apt/data" style={{ padding: '5px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>📁 통계 자료실</Link>
          <Link href="/apt/map" style={{ padding: '5px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>🗺️ 지도</Link>
        </div>
      </section>
      <TopBuilders />
    </div>

    <Disclaimer type="apt" />
  </>;
}
