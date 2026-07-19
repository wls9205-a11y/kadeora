/**
 * 스크랩된 이미지 title/alt(네이버·카카오 이미지검색 item.title)를 alt/caption 으로
 * 쓰기 전 정제.
 *
 * 배경: KB부동산 등 원본 페이지의 alt 템플릿 결함(예: `'단지명' 시세, 가격, 매매, 전세
 * undefined 시세, 가격, 매매, 전세`)이 item.title 로 그대로 유입되어 발행 콘텐츠 alt 에
 * `undefined` / 키워드 중복 / 빈 단지명이 노출되던 회귀 차단.
 *
 * 정책: 스크랩 title 이 아래 중 하나로 "깨진" 경우 우리가 아는 이름(단지명/포스트 제목)으로
 * 대체하고, 정상이면 원문 유지.
 *   - 빈 문자열
 *   - `undefined` / `null` 토큰 포함
 *   - 빈 단지명 따옴표쌍 (`' '`, `''`)
 *   - `시세[,] 가격[,] 매매[,] 전세` 키워드 블록 중복
 *
 * @param scraped  스크랩된 title/alt (nullable)
 * @param fallback 대체 이름 — 호출부가 아는 단지명 또는 blog_posts.title
 * @returns 최대 200자 alt (항상 non-empty; 대체값도 비면 원문 trim)
 */
export function cleanScrapedAlt(scraped: string | null | undefined, fallback: string): string {
  const s = String(scraped ?? '').replace(/<[^>]*>/g, '').trim();
  const fb = String(fallback ?? '').trim();

  const broken =
    !s ||
    /\b(?:undefined|null)\b/i.test(s) ||
    /'\s*'/.test(s) ||
    /시세,?\s*가격,?\s*매매,?\s*전세[\s\S]*?시세,?\s*가격,?\s*매매,?\s*전세/.test(s);

  const out = (broken ? fb : s) || s || fb;
  return out.slice(0, 200);
}
