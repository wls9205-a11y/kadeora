// V13 A-1 — /apt 공고 전 현장 데이터 레이어.
//
// 왜 필요한가: 활성 현장 5,916곳 중 2,975곳(50.3%)에 모집공고가 없다.
// /apt 허브는 get_apt_subscription_hub 가 apt_subscriptions 전용이라 이 절반을
// 한 건도 내지 못한다. 상세 페이지는 있는데 목록에서 도달할 경로가 없었다.
//
// get_apt_pipeline RPC 한 방으로 끝낸다 (Architecture Rule #49).
// 캐시는 hub.ts · archive.ts 와 같은 규약 — 페이지가 searchParams 를 읽어
// dynamic 으로 강등되므로 데이터 레이어에서 unstable_cache 를 직접 걸고,
// 빈 결과는 캐시에 굳히지 않는다 (Rule #66).
//
// ⚠️ 범위를 넓히지 말 것. RPC 가 이미 파이프라인 단계만 필터한다 —
//    site_planning · pre_announcement · union_established · constructor_selected ·
//    plan_approved · construction. 여기서 2,975건을 전부 풀면 빈 페이지를 양산한다 (리스크 #3).
//
// ⚠️ 2026-08-23 실측: RPC 의 IN 목록과 weight CASE 에 mgmt_approved(관리처분인가)가 빠져 있다.
//    부산 5곳이 목록에서 통째로 누락된다 (부산 17 → 22 · 부울경 35 → 40).
//    RPC 수정은 DB 담당 몫이다. 프론트는 값이 실려 오는 즉시 그리도록 이미 열려 있다.

import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { KR_REGIONS_17 } from '@/lib/region-storage';

export const APT_PIPELINE_REVALIDATE_SECONDS = 900;

/** /apt 섹션에 낼 건수. 전체는 /apt/pipeline 이 받는다. */
export const PIPELINE_SECTION_LIMIT = 8;

/**
 * RPC 의 하드 상한. get_apt_pipeline 이 `least(greatest(p_limit,1),60)` 으로 클램프한다.
 * ⚠️ 전국 총계는 209건이라 전체 보기 페이지도 60건까지만 낼 수 있다.
 *    페이지네이션은 RPC 에 오프셋이 붙은 뒤의 일이다 (DB 담당). 지금은 총계를 솔직히 밝힌다.
 */
export const PIPELINE_MAX_LIMIT = 60;

/** 부산·울산·경남을 한 덩어리로 부르는 이름. RPC 가 이 문자열을 특별 취급한다. */
export const BUGYEONG = '부울경';
export const BUGYEONG_REGIONS = ['부산', '울산', '경남'] as const;

/** RPC 가 받는 지역 값. 전국 · 부울경 · 17개 시·도. */
export function normalizePipelineRegion(v?: string | null): string {
  const s = (v ?? '').trim();
  if (!s) return BUGYEONG;
  if (s === BUGYEONG || s === '전국') return s;
  return (KR_REGIONS_17 as readonly string[]).includes(s) ? s : BUGYEONG;
}

/**
 * 공고 전 현장 1건.
 * 필드 이름을 허브(AptHubItem)와 맞춰 둔 것은 RPC 의 의도다 — 같은 .kd-lrow 행을 쓴다.
 *
 * ⚠️ id 는 apt_sites.id 라 uuid 다 (허브의 number 와 다르다).
 *    허브 행 컴포넌트에 그대로 넘기지 말 것. 전용 PipelineCard 를 쓴다.
 */
export interface AptPipelineItem {
  id: string;
  house_nm: string | null;
  site_slug: string | null;
  region_nm: string | null;
  supply_addr: string | null;
  households: number | null;
  builder: string | null;
  thumb_url: string | null;
  /** apt_sites.lifecycle_stage 원문. 라벨은 lib/apt/lifecycle-label.ts 가 붙인다. */
  status: string | null;
  previous_stage: string | null;
  stage_updated_at: string | null;
  /** confirmed | estimated | rumor. RPC 가 NULL 을 confirmed 로 채워 내려준다. */
  confidence: string | null;
  weight: number;
}

export interface AptPipelinePayload {
  region: string;
  /** 필터에 걸린 전체 건수. items.length 는 limit 로 잘린 값이다. */
  total: number;
  items: AptPipelineItem[];
}

export const EMPTY_PIPELINE: AptPipelinePayload = { region: BUGYEONG, total: 0, items: [] };

function normalize(raw: unknown, region: string): AptPipelinePayload {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PIPELINE, region };
  const r = raw as Partial<AptPipelinePayload>;
  return {
    region: r.region ?? region,
    total: Number(r.total) || 0,
    items: Array.isArray(r.items) ? (r.items as AptPipelineItem[]) : [],
  };
}

async function fetchPipelineUncached(region: string, limit: number): Promise<AptPipelinePayload> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_apt_pipeline', {
      p_region: region,
      p_limit: limit,
    });
    if (error) {
      console.error('[apt/pipeline] rpc error:', JSON.stringify(error));
      return { ...EMPTY_PIPELINE, region };
    }
    const payload = normalize(data, region);
    console.log(
      `[apt/pipeline] region=${region} limit=${limit} items=${payload.items.length} total=${payload.total}`,
    );
    return payload;
  } catch (e: any) {
    console.error('[apt/pipeline] caught:', e?.message ?? String(e));
    return { ...EMPTY_PIPELINE, region };
  }
}

const fetchPipelineCached = unstable_cache(fetchPipelineUncached, ['apt-pipeline'], {
  revalidate: APT_PIPELINE_REVALIDATE_SECONDS,
  tags: ['apt-pipeline'],
});

/** 빈 결과는 캐시에 굳히지 않는다 (Rule #66). */
export async function getAptPipeline(
  region: string,
  limit: number = PIPELINE_SECTION_LIMIT,
): Promise<AptPipelinePayload> {
  const capped = Math.min(Math.max(limit, 1), PIPELINE_MAX_LIMIT);
  const cached = await fetchPipelineCached(region, capped);
  if (cached.items.length > 0) return cached;
  return fetchPipelineUncached(region, capped);
}

/** 현장 상세 링크. slug 가 없으면 상세가 없는 것이므로 링크를 만들지 않는다. */
export function pipelineHref(item: Pick<AptPipelineItem, 'site_slug'>): string | null {
  return item.site_slug ? `/apt/${encodeURIComponent(item.site_slug)}` : null;
}

/** 단계 변경이 최근 30일 이내인가. NEW 배지 조건. */
export function isRecentStageChange(
  stageUpdatedAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!stageUpdatedAt) return false;
  const t = Date.parse(stageUpdatedAt);
  if (!Number.isFinite(t)) return false;
  const days = (now - t) / 86_400_000;
  return days >= 0 && days <= 30;
}
