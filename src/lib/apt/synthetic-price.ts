/**
 * Q-1 F1 1단 — 합성 분양가 표시 격리 (2026-09-14).
 *
 * `apt_sites.price_source = 'synthetic'` 은 지역 채움값이다(판정기 DB `fn_mark_synthetic_prices`).
 * ⛔ 판정을 여기서 다시 하지 않는다 — 판정은 DB 한 곳, 코드는 «표시하지 않기» 만 한다.
 *
 * ⚠️ 소비 지점은 «읽는 순간» 이다. 상세 페이지는 헤더·title·og:price·FAQ·JSON-LD offers·비교·alt 가
 *    전부 `site.price_min/max` 를 따로 읽는다. 경로마다 막으면 하나를 반드시 놓친다 —
 *    불러온 직후 값을 비워 두면 뒤는 이미 있는 「분양가 미공개」 폴백(s2)을 저절로 탄다.
 */
export const isSyntheticPrice = (row: { price_source?: string | null } | null | undefined): boolean =>
  row?.price_source === 'synthetic';

export function stripSyntheticPrice<T extends { price_min?: number | null; price_max?: number | null; price_source?: string | null }>(
  row: T,
): T {
  if (!isSyntheticPrice(row)) return row;
  return { ...row, price_min: null, price_max: null };
}

/** 금액 표기 — 「2.1억」「5억원」「21,000만원」. */
const AMOUNT = /\d+(?:\.\d+)?\s*억|\d{1,3}(?:,\d{3})+\s*만\s*원?/;

/**
 * Q-2 — 합성 분양가 현장의 «저장된 FAQ» 중 금액을 말하는 문항을 뺀다.
 * ⚠️ 표시 값을 비워도 생성 당시 합성가로 쓴 문장(「분양가 2.1억원에서 추가 비용이…」)은 남는다(범천1-1 실측).
 * ⛔ 행을 지우지 않는다 — 렌더에서만 뺀다. 재생성은 FAQ 재생성 배치(Q-5 F6) 몫이다.
 */
export function dropAmountFaqs<T extends { q?: string | null; a?: string | null }>(items: T[], synthetic: boolean): T[] {
  if (!synthetic) return items;
  return items.filter((it) => !AMOUNT.test(`${it.q ?? ''} ${it.a ?? ''}`));
}
