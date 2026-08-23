// V17 F-1 — 공고 전 현장 목록 노출 조건.
//
// 진행 이력 · 시공사 · 세대수 · 위치(시군구까지) 중 **2개 이상**일 때만 목록에 낸다.
// 공고 전 현장은 분양가도 일정도 없다. 그마저 아무것도 없는 페이지를 733곳 만들면
// 목록은 길어지는데 누를 만한 게 없고, 파워링크 랜딩으로도 못 쓴다.
//
// 실측 2026-08-24: 파이프라인 206곳 중 **93곳만 통과**(113곳 탈락).
//   부울경은 40 → 35 로, 전국은 206 → 93 으로 줄어든다.
//
// ⚠️ 판정 규칙은 여기 한 곳에만 둔다. /apt 섹션과 /apt/pipeline 이 서로 다른 기준을 쓰면
//    같은 현장이 한쪽에만 나온다.

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { AptPipelineItem } from '@/lib/apt/pipeline';

/** 통과 기준. 넷 중 둘. */
export const MIN_SIGNALS = 2;

export interface CompositionSignals {
  history: boolean;
  builder: boolean;
  units: boolean;
  /** 시군구까지 있는가. 시·도만으로는 "어디" 를 답하지 못한다. */
  location: boolean;
}

/**
 * RPC 의 supply_addr 은 `concat_ws(' ', region, sigungu, dong)` 이라 시·도만 있어도 비지 않는다.
 * 그래서 "지역명 말고 뒤에 뭐가 더 있는가" 로 본다.
 */
export function hasSigungu(supplyAddr: string | null, region: string | null): boolean {
  const addr = (supplyAddr ?? '').trim();
  if (!addr) return false;
  const tail = region && addr.startsWith(region) ? addr.slice(region.length) : addr;
  return tail.trim().length > 0;
}

export function signalsOf(item: AptPipelineItem, hasHistory: boolean): CompositionSignals {
  return {
    history: hasHistory,
    builder: !!(item.builder && item.builder.trim()),
    units: typeof item.households === 'number' && item.households > 0,
    location: hasSigungu(item.supply_addr, item.region_nm),
  };
}

export function countSignals(s: CompositionSignals): number {
  return Number(s.history) + Number(s.builder) + Number(s.units) + Number(s.location);
}

export function passesComposition(item: AptPipelineItem, hasHistory: boolean): boolean {
  return countSignals(signalsOf(item, hasHistory)) >= MIN_SIGNALS;
}

/**
 * 이력이 있는 site_id 집합. 목록 한 페이지분만 물어본다 (id 목록을 그대로 넘긴다).
 * 실패하면 **빈 집합**을 돌려준다 — 이력을 "있다" 고 가정하면 조건이 느슨해진다.
 */
export async function siteIdsWithHistory(siteIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (siteIds.length === 0) return out;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any)
      .from('apt_site_events')
      .select('site_id')
      .in('site_id', siteIds);
    if (error) {
      console.error('[apt/pipeline-gate]', JSON.stringify(error));
      return out;
    }
    for (const r of (data ?? []) as Array<{ site_id: string }>) out.add(r.site_id);
  } catch (e: any) {
    console.error('[apt/pipeline-gate] caught:', e?.message ?? String(e));
  }
  return out;
}

/** 목록에 낼 것만 남긴다. */
export async function filterByComposition(items: AptPipelineItem[]): Promise<AptPipelineItem[]> {
  if (items.length === 0) return items;
  const withHistory = await siteIdsWithHistory(items.map((i) => i.id));
  return items.filter((i) => passesComposition(i, withHistory.has(i.id)));
}
