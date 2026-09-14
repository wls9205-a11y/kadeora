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
