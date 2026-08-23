// src/lib/apt/hub.ts — s273 /apt 청약 허브 데이터 레이어
//
// get_apt_subscription_hub 단일 RPC 를 900초 ISR 로 감싼다 (Architecture Rule #49).
//
// 페이지에 `export const revalidate = 900` 을 걸어도, /apt 는 searchParams(region)를
// 읽기 때문에 Next 15 가 라우트를 dynamic 으로 강등시켜 page-level revalidate 가
// 사실상 무력화된다. 그래서 데이터 레이어에서 unstable_cache 로 직접 900초를 건다.
// 이렇게 하면 region 별로 캐시 키가 갈리면서 실제 ISR 효과를 얻고,
// 동시에 Rule #66 (SSG empty cache 영구화 회피) 도 지켜진다 —
// RPC 가 비면 캐시에 넣지 않고 그대로 빈 값을 반환한 뒤 다음 요청에서 재시도한다.

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAptSlug } from '@/lib/apt-slug';
import type { SubscriptionStatus } from '@/lib/apt/subscription-status';

export const APT_HUB_REVALIDATE_SECONDS = 900;

/** RPC 가 3블록 전부 동일하게 내려주는 평탄 아이템 (Architecture Rule #99). */
export interface AptHubItem {
  id: number;
  house_manage_no: string | null;
  house_nm: string | null;
  region_nm: string | null;
  supply_addr: string | null;
  households: number | null;
  price_per_pyeong: number | null;
  rcept_bgnde: string | null;
  rcept_endde: string | null;
  spsply_rcept_bgnde: string | null;
  przwner_presnatn_de: string | null;
  cntrct_cncls_bgnde: string | null;
  cntrct_cncls_endde: string | null;
  status: SubscriptionStatus;
  weight: number;
  dday: number | null;
  competition_rate: number | null;
  total_applicants: number | null;
  min_score: number | null;
  pblanc_url: string | null;
  /** v4: apt_sites 조인으로 새로 실린 3개. 없는 현장이 있으므로 전부 nullable. */
  builder: string | null;
  /** apt_sites.slug. 있으면 이 값으로 링크한다 — 슬러그 생성보다 정확하다. */
  site_slug: string | null;
  /** hero_image_url → satellite_image_url 순으로 RPC 가 고른 1장. 지역 편차가 크다
   *  (실측 2026-08-23: 부산 16/17 · 경기 10/30). 없을 때의 폴백은 화면 쪽 책임. */
  thumb_url: string | null;
}

/** 지역 칩용 집계. 현재 선택 지역과 무관하게 항상 전국 17개 시·도 기준. */
export interface AptHubRegionCount {
  region: string;
  live: number;
  recent: number;
}

export interface AptHubPayload {
  region: string;
  requested_region: string;
  /**
   * @deprecated v4-C6 — RPC 가 항상 false 를 반환한다. 지역을 버리고 전국으로
   * 갈아타는 폴백 자체가 없어졌다. 다음 정리 때 필드를 지운다.
   */
  region_fallback: boolean;
  /**
   * 선택 지역에 최근 1년 공고가 아예 없을 때만 true.
   * 이때도 region 은 요청 지역 그대로다 — 목록만 비어 있다.
   */
  region_empty: boolean;
  /**
   * 실제로 조회한 창(일). 60 → 180 → 365 사다리.
   * 60 보다 넓으면 "최근 6개월/1년" 이라고 밝혀야 한다 —
   * 안 밝히면 오래된 공고가 오늘 것처럼 보인다.
   */
  window_days: number;
  today: string;
  timeline: AptHubItem[];
  cards: AptHubItem[];
  results: AptHubItem[];
  regions: AptHubRegionCount[];
  counts: { timeline: number; cards: number; results: number };
}

export const EMPTY_HUB: AptHubPayload = {
  region: '전국',
  requested_region: '전국',
  region_fallback: false,
  region_empty: true,
  window_days: 60,
  today: '',
  timeline: [],
  cards: [],
  results: [],
  regions: [],
  counts: { timeline: 0, cards: 0, results: 0 },
};

/**
 * 단지 상세 링크.
 * v4: RPC 가 apt_sites.slug 를 실어 주면 그걸 그대로 쓴다 — 생성 슬러그는
 * house_nm 에서 만든 추정값이라 실제 현장 페이지와 어긋나면 404 가 된다.
 * site_slug 가 없을 때만 기존 생성 로직으로 떨어진다 (/apt/[id] 가 301 로 받는다).
 */
export function aptHref(
  item: Pick<AptHubItem, 'house_nm' | 'house_manage_no' | 'id'> & { site_slug?: string | null },
): string {
  if (item.site_slug) return `/apt/${encodeURIComponent(item.site_slug)}`;
  const slug = generateAptSlug(item.house_nm ?? '');
  if (slug) return `/apt/${encodeURIComponent(slug)}`;
  return `/apt/${item.house_manage_no ?? item.id}`;
}

function normalize(raw: unknown): AptHubPayload {
  if (!raw || typeof raw !== 'object') return EMPTY_HUB;
  const r = raw as Partial<AptHubPayload>;
  const arr = (v: unknown): AptHubItem[] => (Array.isArray(v) ? (v as AptHubItem[]) : []);
  const timeline = arr(r.timeline);
  const cards = arr(r.cards);
  const results = arr(r.results);
  return {
    region: r.region ?? '전국',
    requested_region: r.requested_region ?? r.region ?? '전국',
    region_fallback: Boolean(r.region_fallback),
    region_empty: Boolean(r.region_empty),
    // RPC 가 안 주면 60 으로 떨어뜨린다 — 0 이면 화면이 '최근 0일' 을 말한다.
    window_days: Number(r.window_days) > 0 ? Number(r.window_days) : 60,
    today: r.today ?? '',
    timeline,
    cards,
    results,
    regions: Array.isArray(r.regions) ? (r.regions as AptHubRegionCount[]) : [],
    counts: {
      timeline: timeline.length,
      cards: cards.length,
      results: results.length,
    },
  };
}

async function fetchHubUncached(region: string): Promise<AptHubPayload> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_subscription_hub', {
      p_region: region,
    });
    if (error) {
      console.error('[apt/hub] rpc error:', JSON.stringify(error));
      return { ...EMPTY_HUB, region, requested_region: region };
    }
    const payload = normalize(data);
    console.log(
      `[apt/hub] region=${region} timeline=${payload.counts.timeline} ` +
        `cards=${payload.counts.cards} results=${payload.counts.results} ` +
        `window=${payload.window_days}d empty=${payload.region_empty}`,
    );
    return payload;
  } catch (e: any) {
    console.error('[apt/hub] caught:', e?.message ?? String(e));
    return { ...EMPTY_HUB, region, requested_region: region };
  }
}

const fetchHubCached = unstable_cache(fetchHubUncached, ['apt-subscription-hub'], {
  revalidate: APT_HUB_REVALIDATE_SECONDS,
  tags: ['apt-hub'],
});

/**
 * 허브 데이터를 가져온다.
 *
 * 결과가 완전히 빈 경우(RPC 실패/타이밍 레이스)는 캐시에 굳히지 않기 위해
 * uncached 경로로 한 번 더 시도한다. s269c 의 "빈 페이지가 캐시에 영구화" 회귀
 * (Architecture Rule #66) 재발 방지.
 */
export async function getAptHub(region: string): Promise<AptHubPayload> {
  const cached = await fetchHubCached(region);
  if (cached.counts.cards > 0 || cached.counts.timeline > 0) return cached;
  return fetchHubUncached(region);
}
