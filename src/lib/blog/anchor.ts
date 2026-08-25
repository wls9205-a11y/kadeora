// 앵커 텍스트 회전.
//
// 같은 앵커를 반복하면 과최적화 신호가 된다. 그래서 name_variants 를 돌려 쓴다.
//
// ── ⚠️ 그런데 variants 를 그대로 쓰면 안 된다 ──
// 실측(get_backlink_targets):
//   `창원 의창 푸르지오` → variants: ["의창","창원","창원 의창 푸르지오","푸르지오", …]
//   `부산 에코델타 롯데캐슬` → variants: ["롯데캐슬","부산","에코델타", …]
// `부산`·`푸르지오`·`롯데캐슬` 을 특정 현장 링크의 앵커로 쓰면
//   ① 그 링크가 무엇을 가리키는지 읽는 사람이 알 수 없고
//   ② 브랜드·지역 일반 검색어에 엉뚱한 현장이 매달린다
// 검색엔진에도 사람에게도 **잘못된 신호**다.
//
// → 앵커는 **그 현장을 식별할 수 있을 만큼** 구체적이어야 한다.

/** 앵커로 쓰기에 너무 짧은 절대 하한. */
const MIN_ANCHOR_LEN = 5;

/**
 * 원 이름 대비 이 비율보다 짧은 변형은 앵커로 쓰지 않는다.
 * `창원 의창 푸르지오`(11자) 기준 `푸르지오`(4자)는 0.36 → 탈락,
 * `창원의창푸르지오`(8자)는 0.73 → 통과.
 */
const MIN_RATIO = 0.6;

/**
 * 이 현장을 식별하기에 충분한 앵커 후보만 남긴다.
 * ⚠️ 항상 원 이름을 첫 번째로 둔다 — 후보가 하나도 없어도 앵커는 만들어져야 한다.
 */
/**
 * 시공사명이 든 변형을 앵커 후보에서 뺀다.
 *
 * ⚠️ 실측: `부산 수정5 재개발` 의 name_variants 에 `동구 대우건설` 이 들어 있어
 *    `- [동구 대우건설](/apt/부산-수정5-재개발)` 이 그대로 나갔다.
 *    길이 기준(MIN_RATIO)만으로는 안 걸린다 — 글자 수는 충분하기 때문이다.
 *    시공사 일반 검색어에 엉뚱한 현장이 매달리는, 이 파일이 막으려는 바로 그 문제다.
 *
 * ⚠️ **현장 이름에 시공사가 들어있으면 빼지 않는다.** `해운대 아이파크` 처럼
 *    브랜드가 곧 현장명인 경우가 있어, 그때까지 버리면 앵커가 원 이름 하나로 줄어든다.
 */
function builderTokens(builder: string | null | undefined, name: string): string[] {
  return (builder ?? '')
    .split(/[,&/]/)
    .map((s) => s.replace(/^\s*(\(주\)|㈜|주식회사)\s*/, '').trim())
    .filter((s) => s.length > 1 && !name.includes(s));
}

export function anchorPool(
  name: string,
  variants: unknown,
  builder?: string | null,
): string[] {
  const base = (name ?? '').trim();
  const list = Array.isArray(variants) ? variants : [];
  const minLen = Math.max(MIN_ANCHOR_LEN, Math.ceil(base.replace(/\s+/g, '').length * MIN_RATIO));
  const bad = builderTokens(builder, base);

  const ok = list
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.replace(/\s+/g, '').length >= minLen)
    // 하이픈 슬러그 형태(`창원-의창-푸르지오`)는 사람이 읽는 문구가 아니다.
    .filter((v) => !/^[\w가-힣]+(-[\w가-힣]+)+$/.test(v))
    // 시공사명이 든 변형은 그 현장을 가리키는 문구가 아니다.
    .filter((v) => !bad.some((t) => v.includes(t)));

  // ⚠️ 중복 판정에서 **공백을 지우지 말 것.**
  //    `창원 의창 푸르지오` 와 `창원의창푸르지오` 를 같은 것으로 접으면 풀이 1개가 되고,
  //    그러면 한 글의 모든 링크가 같은 앵커를 쓰게 된다 — 막으려던 과최적화가 그대로 일어난다.
  //    띄어쓰기 변형은 읽는 사람에게 다른 문구이고, 실제 검색어로도 둘 다 쓰인다.
  const seen = new Set<string>();
  return [base, ...ok].filter((v) => {
    const k = v.toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 인덱스로 돌려 쓴다. 링크 대상은 항상 슬러그 — 앵커만 바뀐다. */
export function rotateAnchor(
  name: string,
  variants: unknown,
  i: number,
  builder?: string | null,
): string {
  const pool = anchorPool(name, variants, builder);
  return pool.length === 0 ? name : pool[i % pool.length];
}
