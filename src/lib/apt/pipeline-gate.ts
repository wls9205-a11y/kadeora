// V17 F-1 — 공고 전 현장 목록 노출 조건의 **명세**.
//
// ⚠️ 이 규칙은 이제 DB 가 집행한다. `get_apt_pipeline` 이 게이트를 적용해 내려주고
//    응답에 `gated: true` 가 붙는다. 프론트는 받은 걸 그대로 낸다 —
//    여기 있는 함수를 목록 필터로 다시 쓰지 말 것. 규칙이 두 벌이 된다.
//
// 그러면 왜 남겨 두나: **규칙이 DB 로 갔다고 검증까지 사라지면, 나중에 RPC 를 고칠 때
// 조건이 조용히 바뀐다.** 이 파일과 `__tests__/apt-pipeline-gate.test.ts` 는
// "무엇이 통과해야 하는가" 를 실행 가능한 형태로 고정해 둔 것이다.
// RPC 를 손볼 때 이 테스트가 여전히 같은 답을 내는지로 대조한다.
//
// ── 집행 중인 RPC 조건 (2026-08-24) ──
//   진행 이력 · 시공사 · 세대수 · 위치(시군구) 중 2개 이상
//
//   ((select count(*) from apt_site_events e where e.site_id = s.id) > 0)::int
//     + (s.builder is not null)::int
//     + (coalesce(s.supply_units, s.complex_units, s.total_units) is not null)::int
//     + (s.sigungu is not null)::int >= 2
//
//   ⚠️ 위치는 `sigungu` 로 본다. `supply_addr` 은 concat_ws(region, sigungu, dong) 이라
//      시·도만 있어도 문자열이 비지 않는다 — 그걸로 판정하면 전부 통과한다.
//
// ── 실측 기준값 (2026-08-24 · page_size 30) ──
//   전국 93곳 / 4쪽 (마지막 쪽 3건) · 부울경 35곳 / 2쪽 · 부산 21곳
//   게이트 이전에는 전국 206곳이었다 — 113곳이 조건 미달로 빠진다.

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
 * 목록 응답에는 sigungu 가 따로 없고 supply_addr 만 온다.
 * 그래서 "지역명 뒤에 뭐가 더 있는가" 로 같은 판정을 재현한다.
 * (RPC 는 컬럼을 직접 보므로 이쪽이 더 느슨해질 수 없다.)
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
    // RPC 는 coalesce(supply_units, complex_units, total_units) 를 본다.
    // 목록 응답의 households 가 그 결과값이다.
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
