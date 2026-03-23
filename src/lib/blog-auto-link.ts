/**
 * 블로그 본문 HTML에 자동 내부링크 삽입
 * - 키워드 → 카더라 내부 페이지 자동 연결
 * - SEO: 14,578개 블로그 → 주식/부동산/시리즈 페이지 교차 링크
 * - 1 키워드 = 1 링크만 (과도한 링크 방지)
 */

const STOCK_KEYWORDS: [string, string][] = [
  ['삼성전자', '/stock/005930'], ['SK하이닉스', '/stock/000660'],
  ['네이버', '/stock/035420'], ['카카오', '/stock/035720'],
  ['LG에너지솔루션', '/stock/373220'], ['현대차', '/stock/005380'],
  ['기아', '/stock/000270'], ['셀트리온', '/stock/068270'],
  ['POSCO홀딩스', '/stock/005490'], ['삼성바이오로직스', '/stock/207940'],
];

const APT_KEYWORDS: [string, string][] = [
  ['서울 아파트', '/apt/region/서울'], ['강남 아파트', '/apt/region/강남구'],
  ['부산 아파트', '/apt/region/부산'], ['경기 아파트', '/apt/region/경기'],
  ['인천 아파트', '/apt/region/인천'], ['대구 아파트', '/apt/region/대구'],
  ['청약 일정', '/apt'], ['미분양 현황', '/apt'],
  ['재개발', '/apt'], ['실거래가', '/apt/search'],
];

const FEATURE_KEYWORDS: [string, string][] = [
  ['종목 비교', '/stock/compare'], ['관심종목', '/stock'],
  ['부동산 지도', '/apt/map'], ['블로그 시리즈', '/blog/series'],
];

const ALL_KEYWORDS = [...STOCK_KEYWORDS, ...APT_KEYWORDS, ...FEATURE_KEYWORDS];

export function injectInternalLinks(html: string): string {
  if (!html || html.length < 200) return html;

  const linked = new Set<string>();
  let result = html;

  for (const [keyword, href] of ALL_KEYWORDS) {
    if (linked.has(keyword)) continue;

    // <a>, <h2>, <h3>, <code> 태그 안의 텍스트는 건드리지 않음
    // 단순 텍스트 노드에서만 첫 번째 매칭 1회만 교체
    const safePattern = new RegExp(
      `(?<![<\\/\\w])(?<!href=")(?<!">)(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![^<]*<\\/a>)(?![^<]*<\\/h[23]>)(?![^<]*<\\/code>)`,
      ''
    );

    if (safePattern.test(result)) {
      result = result.replace(
        safePattern,
        `<a href="${href}" style="color:var(--brand);text-decoration:underline;text-underline-offset:2px" title="${keyword} — 카더라">${keyword}</a>`
      );
      linked.add(keyword);
    }

    // 최대 5개 링크까지만
    if (linked.size >= 5) break;
  }

  return result;
}
