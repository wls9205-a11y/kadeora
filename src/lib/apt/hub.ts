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
}

export interface AptHubPayload {
  region: string;
  requested_region: string;
  region_fallback: boolean;
  today: string;
  timeline: AptHubItem[];
  cards: AptHubItem[];
  results: AptHubItem[];
  counts: { timeline: number; cards: number; results: number };
}

export const EMPTY_HUB: AptHubPayload = {
  region: '전국',
  requested_region: '전국',
  region_fallback: false,
  today: '',
  timeline: [],
  cards: [],
  results: [],
  counts: { timeline: 0, cards: 0, results: 0 },
};

/** 단지 상세 링크. /apt/[id] 가 house_nm 기반 slug 로 301 하므로 미리 slug 를 만들어 hop 을 없앤다. */
export function aptHref(item: Pick<AptHubItem, 'house_nm' | 'house_manage_no' | 'id'>): string {
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
    today: r.today ?? '',
    timeline,
    cards,
    results,
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
        `fallback=${payload.region_fallback}`,
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
