// /apt 메인 페이지의 region-aware fetcher 모음.
// server-only — supabase-admin 사용. 모든 함수는 fail-soft (실패 시 빈 결과 반환).

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type AptCategory = 'all' | 'subscription' | 'imminent_d7' | 'unsold' | 'redev' | 'trade';
export type AptSortKey = 'popularity' | 'price' | 'units' | 'move_in';

export interface AptFilters {
  region: string;
  sigungu: string | null;
  category: AptCategory;
  price?: string;   // '0-3' | '3-6' | '6-10' | '10-20' | '20+'
  size?: string;    // '59' | '84' | '105+'  (현재 apt_sites 에 평형 컬럼 미확인 → no-op)
  builder?: string;
  sort?: AptSortKey;  // default 'popularity'
  page?: number;       // default 1 (cumulative load: page * 12)
}

export interface AptSiteRow {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  dong: string | null;
  builder: string | null;
  total_units: number | null;
  move_in_date: string | null;
  built_year: number | null;
  price_min: number | null;
  price_max: number | null;
  images: any;
  og_image_url: string | null;
  satellite_image_url: string | null;
  popularity_score?: number | null;
  site_type?: string | null;
  lifecycle_stage?: string | null;
  status?: string | null;
}

const SITE_COLS =
  'id, slug, name, region, sigungu, dong, builder, total_units, move_in_date, built_year, price_min, price_max, images, og_image_url, satellite_image_url, popularity_score, site_type, lifecycle_stage, status';

// ─── 가격대 band ↔ 만원 단위 변환 (apt_sites.price_min/max 단위가 만원 가정) ───
// price_min/max 가 만원 단위 — 1억 = 10000.
function priceBandToRange(band?: string): { min?: number; max?: number } {
  if (!band) return {};
  switch (band) {
    case '0-3': return { max: 30_000 };
    case '3-6': return { min: 30_000, max: 60_000 };
    case '6-10': return { min: 60_000, max: 100_000 };
    case '10-20': return { min: 100_000, max: 200_000 };
    case '20+': return { min: 200_000 };
    default: return {};
  }
}

function applyCommonFilters(q: any, filters: AptFilters) {
  q = q.eq('is_active', true);
  if (filters.region && filters.region !== '전국') q = q.eq('region', filters.region);
  if (filters.sigungu) q = q.eq('sigungu', filters.sigungu);
  if (filters.builder) q = q.eq('builder', filters.builder);
  const { min, max } = priceBandToRange(filters.price);
  if (typeof min === 'number') q = q.gte('price_min', min);
  if (typeof max === 'number') q = q.lte('price_max', max);
  return q;
}

// ─── HeroSite — region 안의 popularity_score 1위 ───
export async function fetchHeroSite(filters: AptFilters): Promise<AptSiteRow | null> {
  try {
    const sb = getSupabaseAdmin();
    let q: any = (sb as any).from('apt_sites').select(SITE_COLS);
    q = applyCommonFilters(q, filters);
    q = q.order('popularity_score', { ascending: false, nullsFirst: false }).limit(1);
    const { data } = await q;
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as AptSiteRow) : null;
    return row;
  } catch {
    return null;
  }
}

// ─── SiteList — 카테고리 분기 + sort/page ───
// page 는 cumulative load 모델: page=1 → 12 row, page=2 → 24 row, page=3 → 36 row.
function applySort(q: any, sort: AptSortKey | undefined): any {
  switch (sort) {
    case 'price':
      return q.order('price_max', { ascending: true, nullsFirst: false }).order('price_min', { ascending: true, nullsFirst: false });
    case 'units':
      return q.order('total_units', { ascending: false, nullsFirst: false });
    case 'move_in':
      return q.order('move_in_date', { ascending: true, nullsFirst: false });
    case 'popularity':
    default:
      return q.order('popularity_score', { ascending: false, nullsFirst: false });
  }
}

export async function fetchSiteList(filters: AptFilters, perPage = 12): Promise<AptSiteRow[]> {
  const page = Math.max(1, Math.min(10, filters.page ?? 1));
  const total = perPage * page;

  try {
    const sb = getSupabaseAdmin();

    // imminent_d7 만 view 사용 (정렬은 days_until_apply 고정)
    if (filters.category === 'imminent_d7') {
      let q: any = (sb as any).from('v_apt_subscription_imminent')
        .select('slug, site_name, region, sigungu, dong, builder, total_units, popularity_score, site_type, lifecycle_stage, days_until_apply, rcept_bgnde, rcept_endde');
      if (filters.region && filters.region !== '전국') q = q.eq('region', filters.region);
      if (filters.sigungu) q = q.eq('sigungu', filters.sigungu);
      if (filters.builder) q = q.eq('builder', filters.builder);
      q = q.gte('days_until_apply', 0).lte('days_until_apply', 7).order('days_until_apply', { ascending: true }).limit(total);
      const { data } = await q;
      return ((data as any[]) || []).map((r) => ({
        id: r.slug, slug: r.slug, name: r.site_name || r.name,
        region: r.region, sigungu: r.sigungu, dong: r.dong,
        builder: r.builder, total_units: r.total_units,
        move_in_date: null, built_year: null,
        price_min: null, price_max: null,
        images: null, og_image_url: null, satellite_image_url: null,
        popularity_score: r.popularity_score,
        site_type: r.site_type, lifecycle_stage: r.lifecycle_stage,
        status: 'active',
      }));
    }

    // 그 외 5 카테고리 — apt_sites
    let q: any = (sb as any).from('apt_sites').select(SITE_COLS);
    q = applyCommonFilters(q, filters);
    if (filters.category === 'subscription') q = q.eq('lifecycle_stage', 'subscription_open');
    else if (filters.category === 'unsold') q = q.eq('site_type', 'unsold');
    else if (filters.category === 'redev') q = q.eq('site_type', 'redevelopment');
    else if (filters.category === 'trade') q = q.eq('site_type', 'trade');
    // 'all' 은 추가 필터 없음

    q = applySort(q, filters.sort).limit(total);
    const { data } = await q;
    return (data as AptSiteRow[]) || [];
  } catch {
    return [];
  }
}

// ─── PriceTrend — 시군구 또는 시도 평균가 + YoY ───
export interface PriceTrendRow {
  region: string;
  sigungu: string | null;
  avg_price: number | null;
  yoy_pct: number | null;
  stat_month: string | null;
}

export async function fetchPriceTrend(region: string, sigungu: string | null): Promise<PriceTrendRow | null> {
  try {
    const sb = getSupabaseAdmin();
    let q: any = (sb as any).from('apt_trade_monthly_stats')
      .select('region, sigungu, avg_price, yoy_pct, stat_month')
      .eq('region', region)
      .order('stat_month', { ascending: false })
      .limit(1);
    if (sigungu) q = q.eq('sigungu', sigungu);
    const { data } = await q;
    return Array.isArray(data) && data.length > 0 ? (data[0] as PriceTrendRow) : null;
  } catch {
    return null;
  }
}

// ─── AIAnalysis — region 태그 포함 최신 블로그 1건 ───
export interface AIAnalysisPost {
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  cover_image: string | null;
}

export async function fetchAIAnalysis(region: string): Promise<AIAnalysisPost | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any).from('blog_posts')
      .select('slug, title, excerpt, published_at, cover_image, tags, category')
      .eq('is_published', true)
      .eq('category', 'apt')
      .contains('tags', [region])
      .order('published_at', { ascending: false })
      .limit(1);
    if (!Array.isArray(data) || data.length === 0) return null;
    const r = data[0];
    return { slug: r.slug, title: r.title, excerpt: r.excerpt ?? null, published_at: r.published_at ?? null, cover_image: r.cover_image ?? null };
  } catch {
    return null;
  }
}

// ─── Builders — region 안에서 시공사별 단지 수 top N ───
export interface BuilderRow { builder: string; count: number; }

export async function fetchBuilders(region: string, limit = 5): Promise<BuilderRow[]> {
  try {
    const sb = getSupabaseAdmin();
    // Supabase 가 직접 GROUP BY 미지원 → builder 컬럼만 가져와 JS 집계.
    let q: any = (sb as any).from('apt_sites').select('builder').eq('is_active', true);
    if (region && region !== '전국') q = q.eq('region', region);
    q = q.not('builder', 'is', null).neq('builder', '');
    const { data } = await q;
    if (!Array.isArray(data)) return [];
    const counts = new Map<string, number>();
    for (const r of data as { builder: string }[]) {
      const b = (r.builder || '').trim();
      if (!b) continue;
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([builder, count]) => ({ builder, count }));
  } catch {
    return [];
  }
}

// ─── countByCategory — AptCategoryTabs 의 옵션 카운트 (region 한정) ───
// 실패해도 빈 객체 반환 → tab 옆 숫자가 안 보일 뿐.
export async function fetchCategoryCounts(region: string, sigungu: string | null): Promise<Partial<Record<AptCategory, number>>> {
  try {
    const sb = getSupabaseAdmin();
    const buildBase = () => {
      let q: any = (sb as any).from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true);
      if (region && region !== '전국') q = q.eq('region', region);
      if (sigungu) q = q.eq('sigungu', sigungu);
      return q;
    };
    const [allR, subR, unsoldR, redevR, tradeR] = await Promise.all([
      buildBase(),
      buildBase().eq('lifecycle_stage', 'subscription_open'),
      buildBase().eq('site_type', 'unsold'),
      buildBase().eq('site_type', 'redevelopment'),
      buildBase().eq('site_type', 'trade'),
    ]);
    // imminent_d7 — view
    let imminentR: any = (sb as any).from('v_apt_subscription_imminent').select('slug', { count: 'exact', head: true });
    if (region && region !== '전국') imminentR = imminentR.eq('region', region);
    if (sigungu) imminentR = imminentR.eq('sigungu', sigungu);
    imminentR = await imminentR.gte('days_until_apply', 0).lte('days_until_apply', 7);

    return {
      all: allR.count ?? 0,
      subscription: subR.count ?? 0,
      imminent_d7: imminentR.count ?? 0,
      unsold: unsoldR.count ?? 0,
      redev: redevR.count ?? 0,
      trade: tradeR.count ?? 0,
    };
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════
// PHASE 2D — 8섹션 신규 fetcher 7개
// ═══════════════════════════════════════════════════════════

// ─── 1. fetchStatsKPI — 4 KPI 카운트 ───
export interface StatsKPI {
  active_sub: number;
  unsold: number;
  redev: number;
  trade_7d: number;
}

export async function fetchStatsKPI(region: string, sigungu: string | null): Promise<StatsKPI> {
  const empty: StatsKPI = { active_sub: 0, unsold: 0, redev: 0, trade_7d: 0 };
  try {
    const sb = getSupabaseAdmin();
    const baseSites = () => {
      let q: any = (sb as any).from('apt_sites').select('id', { count: 'exact', head: true }).eq('is_active', true);
      if (region && region !== '전국') q = q.eq('region', region);
      if (sigungu) q = q.eq('sigungu', sigungu);
      return q;
    };
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let txQ: any = (sb as any).from('apt_transactions').select('id', { count: 'exact', head: true });
    if (region && region !== '전국') txQ = txQ.eq('region_nm', region);
    if (sigungu) txQ = txQ.eq('sigungu', sigungu);
    txQ = txQ.gte('deal_date', sevenDaysAgo);

    const [subR, unsoldR, redevR, tradeR] = await Promise.all([
      baseSites().eq('lifecycle_stage', 'subscription_open'),
      baseSites().eq('site_type', 'unsold'),
      baseSites().eq('site_type', 'redevelopment'),
      txQ,
    ]);
    return {
      active_sub: subR.count ?? 0,
      unsold: unsoldR.count ?? 0,
      redev: redevR.count ?? 0,
      trade_7d: tradeR.count ?? 0,
    };
  } catch {
    return empty;
  }
}

// ─── 2. fetchImminentTop3 — D-7 임박 단지 3개 ───
export interface ImminentRow {
  slug: string;
  site_name: string;
  region: string | null;
  sigungu: string | null;
  rcept_bgnde: string | null;
  rcept_endde: string | null;
  days_until_apply: number;
  popularity_score: number | null;
}

export async function fetchImminentTop3(region: string, sigungu: string | null): Promise<ImminentRow[]> {
  try {
    const sb = getSupabaseAdmin();
    let q: any = (sb as any).from('v_apt_subscription_imminent')
      .select('slug, site_name, region, sigungu, rcept_bgnde, rcept_endde, days_until_apply, popularity_score');
    if (region && region !== '전국') q = q.eq('region', region);
    if (sigungu) q = q.eq('sigungu', sigungu);
    q = q.gte('days_until_apply', 0).lte('days_until_apply', 7).order('days_until_apply', { ascending: true }).limit(3);
    const { data } = await q;
    return (data as ImminentRow[]) || [];
  } catch {
    return [];
  }
}

// ─── 3. fetchSigunguTrends — v_sigungu_trade_stats 12개월 시계열 ───
export interface SigunguTradeRow {
  region_nm: string;
  sigungu: string;
  deal_month: string;
  total_deals: number | null;
  avg_price: number | null;
  avg_price_per_pyeong: number | null;
  avg_area: number | null;
}

export async function fetchSigunguTrends(region: string, sigungu: string | null, months = 12): Promise<SigunguTradeRow[]> {
  try {
    const sb = getSupabaseAdmin();
    let q: any = (sb as any).from('v_sigungu_trade_stats')
      .select('region_nm, sigungu, deal_month, total_deals, avg_price, avg_price_per_pyeong, avg_area')
      .eq('region_nm', region)
      .order('deal_month', { ascending: false })
      .limit(months);
    if (sigungu) q = q.eq('sigungu', sigungu);
    const { data } = await q;
    // 시계열 chart 는 ascending 순서가 자연스러움
    const rows = ((data as SigunguTradeRow[]) || []).slice().reverse();
    return rows;
  } catch {
    return [];
  }
}

// ─── 4. fetchPriceBands — 가격대 5 버킷 (region 한정) ───
// v_apt_by_price_band 는 region 필터 없음 → apt_sites 직접 GROUP BY (JS 쪽 집계).
export interface PriceBandBucket {
  band: string;       // '0-3' | '3-6' | '6-10' | '10-20' | '20+'
  label: string;      // '~3억' 등
  site_count: number;
}

const PRICE_BAND_DEFS: { band: string; label: string; min?: number; max?: number }[] = [
  { band: '0-3',  label: '~3억',   max: 30_000 },
  { band: '3-6',  label: '3-6억',  min: 30_000, max: 60_000 },
  { band: '6-10', label: '6-10억', min: 60_000, max: 100_000 },
  { band: '10-20',label: '10-20억',min: 100_000, max: 200_000 },
  { band: '20+',  label: '20억+',  min: 200_000 },
];

export async function fetchPriceBands(region: string, sigungu: string | null): Promise<PriceBandBucket[]> {
  try {
    const sb = getSupabaseAdmin();
    // apt_sites 의 price_max 만 가져와 JS 쪽 GROUP BY (행 적게 — limit 5000)
    let q: any = (sb as any).from('apt_sites').select('price_max').eq('is_active', true).not('price_max', 'is', null);
    if (region && region !== '전국') q = q.eq('region', region);
    if (sigungu) q = q.eq('sigungu', sigungu);
    q = q.limit(5000);
    const { data } = await q;
    const rows = (data as { price_max: number }[]) || [];

    const counts: Record<string, number> = {};
    for (const r of rows) {
      const v = Number(r.price_max);
      if (!isFinite(v) || v <= 0) continue;
      for (const def of PRICE_BAND_DEFS) {
        const minOk = def.min === undefined || v >= def.min;
        const maxOk = def.max === undefined || v <= def.max;
        if (minOk && maxOk) {
          counts[def.band] = (counts[def.band] || 0) + 1;
          break;
        }
      }
    }
    return PRICE_BAND_DEFS.map((d) => ({ band: d.band, label: d.label, site_count: counts[d.band] || 0 }));
  } catch {
    return PRICE_BAND_DEFS.map((d) => ({ band: d.band, label: d.label, site_count: 0 }));
  }
}

// ─── 5. fetchBuildersHub — region top 6 시공사 + avg_popularity ───
export interface BuilderHubRow {
  builder: string;
  site_count: number;
  avg_popularity: number;
}

export async function fetchBuildersHub(region: string, limit = 6): Promise<BuilderHubRow[]> {
  try {
    const sb = getSupabaseAdmin();
    let q: any = (sb as any).from('apt_sites').select('builder, popularity_score').eq('is_active', true);
    if (region && region !== '전국') q = q.eq('region', region);
    q = q.not('builder', 'is', null).neq('builder', '').limit(8000);
    const { data } = await q;
    if (!Array.isArray(data)) return [];

    const map = new Map<string, { count: number; sum: number; n: number }>();
    for (const r of data as { builder: string; popularity_score: number | null }[]) {
      const b = (r.builder || '').trim();
      if (!b) continue;
      const cur = map.get(b) || { count: 0, sum: 0, n: 0 };
      cur.count += 1;
      if (typeof r.popularity_score === 'number' && r.popularity_score > 0) {
        cur.sum += r.popularity_score; cur.n += 1;
      }
      map.set(b, cur);
    }
    return Array.from(map.entries())
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([builder, v]) => ({
        builder,
        site_count: v.count,
        avg_popularity: v.n > 0 ? Math.round((v.sum / v.n) * 10) / 10 : 0,
      }));
  } catch {
    return [];
  }
}

// ─── 6. fetchRecentTrades — 최근 실거래 10건 + 평당가 계산 ───
export interface RecentTradeRow {
  id: string | number;
  apt_name: string;
  region_nm: string | null;
  sigungu: string | null;
  dong: string | null;
  deal_date: string;
  deal_amount: number | null;       // 만원 단위 가정
  exclusive_area: number | null;    // m²
  floor: number | null;
  built_year: number | null;
  price_per_pyeong: number | null;  // 만원/평 — 계산 결과
}

export async function fetchRecentTrades(region: string, sigungu: string | null, limit = 10): Promise<RecentTradeRow[]> {
  try {
    const sb = getSupabaseAdmin();
    let q: any = (sb as any).from('apt_transactions')
      .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year')
      .order('deal_date', { ascending: false })
      .limit(limit);
    if (region && region !== '전국') q = q.eq('region_nm', region);
    if (sigungu) q = q.eq('sigungu', sigungu);
    const { data } = await q;
    const rows = (data as Array<Omit<RecentTradeRow, 'price_per_pyeong'>>) || [];
    return rows.map((r) => {
      let pp: number | null = null;
      if (r.deal_amount && r.exclusive_area && r.exclusive_area > 0) {
        // 평당가 = (deal_amount 만원) / (exclusive_area m²) * 3.305 m²/평
        pp = Math.round((Number(r.deal_amount) / Number(r.exclusive_area)) * 3.305);
      }
      return { ...r, price_per_pyeong: pp };
    });
  } catch {
    return [];
  }
}

// ─── 7. fetchBlogList — region 태그 포함 블로그 3건 ───
export interface BlogListRow {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  view_count: number | null;
}

export async function fetchBlogList(region: string, limit = 3): Promise<BlogListRow[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any).from('blog_posts')
      .select('slug, title, excerpt, cover_image, published_at, reading_minutes, view_count, tags, category, is_published')
      .eq('is_published', true)
      .eq('category', 'apt')
      .contains('tags', [region])
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(limit);
    return (data as BlogListRow[]) || [];
  } catch {
    return [];
  }
}
