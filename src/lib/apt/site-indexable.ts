/**
 * apt 상세(`/apt/{slug}`) 색인 여부의 «단일 기준» — K-5 (2026-09-16).
 *
 * lib/apt/indexable.ts 가 «허브 목록 건수» 에 대해 하는 일을, 이 파일이 «현장 상세» 에 대해 한다.
 * 그 파일의 문장이 이 파일의 존재 이유이기도 하다 — 「네 곳이 갈리면 클로킹이 된다」.
 *
 * ⛔ 실제로 갈려 있었다 (2026-09-16 실측):
 *     사이트맵  content_score >= 25
 *     본문      content_score <  40 이면 noindex
 *     메타      data_quality_score < 30 이면 noindex   ← 다른 «열» 을 보고 있었다
 *   그래서 268 현장이 「사이트맵에는 실리는데 메타로는 거부되는」 자기모순 상태였다.
 *
 * 임계를 40 으로 단일화한 근거(30일 실측):
 *   · content_score 25~29 대역은 «비어 있다» — 25 컷과 30 컷은 같은 집합을 갈랐다
 *   · cs < 40 인 21 현장은 네이버 유입 0 · 사람 방문 0 — 잘라도 «손실이 0» 이다
 *   · 반대로 data_quality_score < 30 게이트는 289 현장을 막고 있었고, 그중 67 곳이
 *     네이버 실유입처였다(30일 291회 · 전체 apt 네이버 유입의 14%).
 *     색인 게이트가 유입을 죽이고 있었다 — 그래서 이 게이트는 «폐지» 한다.
 *
 * ⚠️ 폐지 대상은 «게이트» 이지 «데이터» 가 아니다. data_quality_score 열은 그대로 둔다
 *    (품질 판정의 재료로는 여전히 쓸 수 있다. 다만 색인 여부를 그 열로 정하지 않는다).
 */

/** 이 점수 미만이면 색인 대상이 아니다. 사이트맵·본문·메타가 «모두» 이 값을 본다. */
export const SITE_INDEX_MIN_SCORE = 40;

export function isSiteIndexable(contentScore: number | null | undefined): boolean {
  return (contentScore ?? 0) >= SITE_INDEX_MIN_SCORE;
}
