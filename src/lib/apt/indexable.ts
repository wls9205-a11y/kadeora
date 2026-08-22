/**
 * 얇은 페이지 차단 단일 기준.
 *
 * 사이트맵 · 메타(robots) · generateStaticParams · 페이지 본문 4곳이 모두 이걸 쓴다.
 * 네 곳이 갈리면 클로킹이 된다 — 사이트맵에 실린 URL 이 본문에서 404 가 나거나,
 * noindex 를 단 페이지가 사이트맵에 남는다(S7-1 재발).
 *
 * lib/apt/hub.ts 에 넣지 않는다 — 그 파일은 P5 가 읽으므로 소유권 충돌을 피한다.
 */

/** 이 수 미만이면 색인 대상이 아니다. */
export const INDEX_MIN = 5;

/** 이 수 이상이면 별도 보강 없이 충분한 페이지로 본다. */
export const RICH_MIN = 12;

export function isIndexable(count: number): boolean {
  return count >= INDEX_MIN;
}

/** 색인은 되지만 내용이 얇아 요약·FAQ 등 보강이 필요한 구간. */
export function needsEnrichment(count: number): boolean {
  return count >= INDEX_MIN && count < RICH_MIN;
}
