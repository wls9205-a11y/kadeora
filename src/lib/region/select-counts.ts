// 지역 셀렉 카운트 — 「실측값」 요구를 «정직하게» 다루는 자리.
//
// ── 이 파일이 막으려는 것 ─────────────────────────────────────────────────
// DB 의 (region, sigungu) 는 문자열이라 트리의 라벨과 «안 맞는 행이 생긴다».
//   ① sigungu 가 빈 행 — 시군구를 모르는 현장이다(실측 78건 / 1,481건).
//   ② region+sigungu 조합이 lawd 라벨에 없는 행 — 개편·오타·미등재.
// 이 둘을 조용히 버리면 시도 칸의 수와 칩 합계가 «말없이» 어긋난다.
// ⛔ 버리지 않는다. 따로 세어 「그 외」로 «말한다» — 숨기는 것보다 낫다(DS_RULES §2-2).

import { REGION_TREE } from '@/lib/region/select-tree';

export interface RegionCountRow {
  region: string;
  sigungu: string;
  upcoming: number;
  open_now: number;
}

export interface Tally { upcoming: number; open: number }
const zero = (): Tally => ({ upcoming: 0, open: 0 });
const add = (t: Tally, r: RegionCountRow): Tally => ({
  upcoming: t.upcoming + (r.upcoming || 0),
  open: t.open + (r.open_now || 0),
});

export interface SidoTally {
  /** 칩으로 고를 수 있는 몫. */
  matched: Tally;
  /** 시군구를 모르거나 라벨에 없어 «칩이 없는» 몫. 0 이면 화면에 안 낸다. */
  other: Tally;
  /** 시도 칸에 찍는 수 = matched + other. */
  total: Tally;
}

export interface RegionCounts {
  bySigunguLabel: Map<string, Tally>;
  bySidoCode: Map<string, SidoTally>;
  nationwide: Tally;
  /** 어느 시도에도 못 붙인 몫 — region 자체가 트리에 없는 경우다. */
  orphan: Tally;
}

/**
 * region 이름 → 시도 코드. 병합 칸(`'광주·전남'`)은 두 이름이 같은 코드를 가리킨다.
 *
 * ⚠️ 실측 — DB 의 `region` 이 트리 이름과 «한 곳» 어긋난다:
 *      트리 `'세종시'`(라벨이 곧 시군구) ↔ DB `'세종'`
 *    그래서 이름이 「…시」로 끝나면 «시를 뗀 형태도» 같은 코드로 등록한다.
 *    ⛔ 이보다 넓은 정규화(「특별자치시」 제거 등)는 하지 않는다 — 그건 추측이고,
 *       추측으로 붙인 행은 「그 외」에서 사라져 «맞은 것처럼» 보인다.
 */
const SIDO_OF_REGION = new Map<string, string>();
for (const s of REGION_TREE) {
  for (const name of s.name.split('·')) {
    SIDO_OF_REGION.set(name, s.code);
    if (name.endsWith('시')) SIDO_OF_REGION.set(name.slice(0, -1), s.code);
  }
}

const SIDO_OF_LABEL = new Map<string, string>();
for (const s of REGION_TREE) for (const n of s.sigungus) SIDO_OF_LABEL.set(n.label, s.code);

export function buildRegionCounts(rows: readonly RegionCountRow[]): RegionCounts {
  const bySigunguLabel = new Map<string, Tally>();
  const bySidoCode = new Map<string, SidoTally>();
  let nationwide = zero();
  let orphan = zero();

  const sido = (code: string): SidoTally => {
    let t = bySidoCode.get(code);
    if (!t) bySidoCode.set(code, (t = { matched: zero(), other: zero(), total: zero() }));
    return t;
  };

  for (const r of rows) {
    nationwide = add(nationwide, r);
    // ⚠️ 세종은 라벨이 곧 시군구다(`'세종시'`). region+sigungu 를 붙이면 「세종 세종시」가 된다.
    // 라벨 후보를 «좁은 것부터» 본다. ⛔ 못 맞으면 지어내지 않고 「그 외」로 센다.
    //    실측 예: 세종 `'세종시'` 는 두 번째에서 맞고, `'세종특별자치시'`·`'행정중심복합도시'`·
    //    제주 `'표선면'`(읍면이다)은 «어디에도 안 맞는다» — 그대로 「그 외」다.
    const joined = r.sigungu ? `${r.region} ${r.sigungu}` : '';
    const chipLabel =
      (joined && SIDO_OF_LABEL.has(joined)) ? joined
      : (r.sigungu && SIDO_OF_LABEL.has(r.sigungu)) ? r.sigungu
      : SIDO_OF_LABEL.has(r.region) ? r.region
      : null;
    const code = (chipLabel && SIDO_OF_LABEL.get(chipLabel)) ?? SIDO_OF_REGION.get(r.region);
    if (!code) { orphan = add(orphan, r); continue; }

    const t = sido(code);
    if (chipLabel) {
      bySigunguLabel.set(chipLabel, add(bySigunguLabel.get(chipLabel) ?? zero(), r));
      t.matched = add(t.matched, r);
    } else {
      t.other = add(t.other, r);
    }
    t.total = add(t.total, r);
  }

  return { bySigunguLabel, bySidoCode, nationwide, orphan };
}

/** 화면 문구용 — 「분양예정 N · 분양중 M」. ⛔ 0 을 숨기지 않는다. 0 은 0 이다. */
export function tallyText(t: Tally | undefined): string {
  const v = t ?? zero();
  return `분양예정 ${v.upcoming} · 분양중 ${v.open}`;
}
