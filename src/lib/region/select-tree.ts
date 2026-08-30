// 지역 셀렉 트리 — «시안의 하드코딩을 복붙하지 않는다». 진실은 lawd.ts 다.
//
// ── 왜 코드로 묶는가 ───────────────────────────────────────────────────────
// 라벨의 시도(「광주」·「전남」)와 코드의 시도(둘 다 12)가 다른 줄이 27개 있다.
// 라벨 접두로 묶으면 17칸이 되고, 코드로 묶으면 «16칸» 이다.
// 수집·조회가 쓰는 축은 코드이므로 «코드로 묶는다» — 화면이 데이터를 따라간다.
// (라벨을 그대로 둔 이유는 lawd.ts 의 12 계열 주석에 있다: DB 어휘를 한 벌로 지킨다.)
//
// ⚠️ URL 직렬화는 «라벨이 아니라 코드 배열» 이다. 창원처럼 한 라벨이 5개 구 코드를
//    갖는 자리가 있어, 라벨로 적으면 사용자가 무엇을 고른 건지 URL 이 말하지 못한다.

import { SIGUNGU_LAWD_CODES, parseRegionSigungu } from '@/lib/region/lawd';

export interface SigunguNode {
  /** 전체 라벨 — `'부산 해운대구'`. DB 의 region+sigungu 와 같은 어휘다. */
  label: string;
  /** 칩에 쓰는 짧은 이름 — `'해운대구'`. 세종은 라벨이 곧 이름이다. */
  short: string;
  /** 이 칩이 가리키는 «코드 전부». 창원은 5개다. */
  codes: readonly string[];
}

export interface SidoNode {
  /** 시도 코드 2자리 — 이것이 «묶는 축» 이다. */
  code: string;
  /** 화면 이름. 코드 하나에 라벨 시도가 둘이면 가운뎃점으로 잇는다(12 → `'광주·전남'`). */
  name: string;
  sigungus: readonly SigunguNode[];
}

/** 시도 표시 순서 — 코드 오름차순. 임의 순서를 만들지 않는다(11 서울 → 52 전북). */
export const REGION_TREE: readonly SidoNode[] = (() => {
  const bySido = new Map<string, SigunguNode[]>();
  const regionsOf = new Map<string, Set<string>>();

  for (const [label, codes] of Object.entries(SIGUNGU_LAWD_CODES)) {
    const sido = codes[0].slice(0, 2);
    const { region, sigungu } = parseRegionSigungu(label);
    (bySido.get(sido) ?? bySido.set(sido, []).get(sido)!).push({
      label,
      // ⚠️ 병합 시도(12)에서는 짧은 이름만 두면 「동구」가 어느 시인지 말하지 못한다.
      //    그 칸에서만 라벨 전체를 쓴다 — 규칙을 화면 전체에 퍼뜨리지 않는다.
      short: sigungu || label,
      codes,
    });
    (regionsOf.get(sido) ?? regionsOf.set(sido, new Set()).get(sido)!).add(region || label);
  }

  return [...bySido.keys()].sort().map((code) => {
    const regions = [...(regionsOf.get(code) ?? [])].sort();
    const merged = regions.length > 1;
    return {
      code,
      name: regions.join('·'),
      sigungus: (bySido.get(code) ?? [])
        .map((n) => (merged ? { ...n, short: n.label } : n))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko')),
    };
  });
})();

/** 코드 → 시군구 노드. 직렬화된 URL 을 다시 화면 상태로 되돌릴 때 쓴다. */
const NODE_BY_CODE = new Map<string, SigunguNode>();
for (const sido of REGION_TREE) for (const n of sido.sigungus) for (const c of n.codes) NODE_BY_CODE.set(c, n);

export function sigunguNodeOfCode(code: string): SigunguNode | null {
  return NODE_BY_CODE.get(code) ?? null;
}

/**
 * 선택 → URL 쿼리 문자열.
 *
 * ⛔ 등재되지 «않은» 코드는 버린다. 없는 코드를 URL 에 실으면 목록이 조용히 0건이 되고,
 *    그 0 은 「그 지역에 없다」로 읽힌다 — 오늘 하루 종일 잡은 그 형태다.
 * ⚠️ 정렬·중복 제거를 «항상» 한다. 같은 선택이 두 개의 URL 이 되면 캐시도 색인도 갈린다.
 */
export function serializeRegionSelection(codes: readonly string[]): string {
  const seen = new Set<string>();
  for (const c of codes) if (NODE_BY_CODE.has(c)) seen.add(c);
  return [...seen].sort().join(',');
}

/** URL 쿼리 → 코드 배열. 못 읽는 값은 «조용히» 버리지 않고 그냥 빠진다(빈 선택 = 전국). */
export function parseRegionSelection(raw: string | string[] | null | undefined): string[] {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return [];
  const out = new Set<string>();
  for (const part of v.split(',')) {
    const c = part.trim();
    if (NODE_BY_CODE.has(c)) out.add(c);
  }
  return [...out].sort();
}

export interface RegionHit {
  sidoCode: string;
  sidoName: string;
  /** 시군구 단위 결과. null 이면 «시·도 전체» 결과다. */
  node: SigunguNode | null;
}

/**
 * 검색 자동완성 — 시도명·시군구명 부분일치.
 *
 * ⛔ 「비슷한 것」을 돌려주지 않는다. 부분일치까지가 끝이고, 오타 교정은 하지 않는다 —
 *    틀린 지역으로 보내는 것보다 «못 찾는» 편이 낫다(alias.ts 와 같은 규율).
 */
export function searchRegions(query: string, limit = 8): RegionHit[] {
  const q = query.trim().replace(/\s+/g, ' ');
  if (!q) return [];
  const hits: RegionHit[] = [];
  for (const sido of REGION_TREE) {
    if (sido.name.includes(q)) hits.push({ sidoCode: sido.code, sidoName: sido.name, node: null });
    for (const n of sido.sigungus) {
      if (n.label.includes(q) || n.short.includes(q)) {
        hits.push({ sidoCode: sido.code, sidoName: sido.name, node: n });
      }
      if (hits.length >= limit) return hits.slice(0, limit);
    }
  }
  return hits.slice(0, limit);
}
