// /apt 메인 페이지의 region-aware fetcher 모음.
// server-only — supabase-admin 사용. 모든 함수는 fail-soft (실패 시 빈 결과 반환).

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type AptCategory = 'all' | 'subscription' | 'imminent_d7' | 'unsold' | 'redev' | 'trade';

export interface AptFilters {
  region: string;
  sigungu: string | null;
  category: AptCategory;
  price?: string;   // '0-3' | '3-6' | '6-10' | '10-20' | '20+'
  size?: string;    // '59' | '84' | '105+'  (현재 apt_sites 에 평형 컬럼 미확인 → no-op)
  builder?: string;
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

// ─── SiteList — 카테고리 분기 ───
export async function fetchSiteList(filters: AptFilters, limit = 6): Promise<AptSiteRow[]> {
  try {
    const sb = getSupabaseAdmin();

    // imminent_d7 만 view 사용
    if (filters.category === 'imminent_d7') {
      let q: any = (sb as any).from('v_apt_subscription_imminent')
        .select('slug, name, region, sigungu, dong, builder, total_units, popularity_score, site_type, lifecycle_stage, days_until_apply, rcept_bgnde, rcept_endde');
      if (filters.region && filters.region !== '전국') q = q.eq('region', filters.region);
      if (filters.sigungu) q = q.eq('sigungu', filters.sigungu);
      if (filters.builder) q = q.eq('builder', filters.builder);
      q = q.gte('days_until_apply', 0).lte('days_until_apply', 7).order('days_until_apply', { ascending: true }).limit(limit);
      const { data } = await q;
      return ((data as any[]) || []).map((r) => ({
        id: r.slug,            // view 에 id 가 없으면 slug 로 대체
        slug: r.slug, name: r.name,
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

    q = q.order('popularity_score', { ascending: false, nullsFirst: false }).limit(limit);
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
