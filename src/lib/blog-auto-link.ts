/**
 * 블로그 본문 HTML에 자동 내부링크 삽입
 * - 키워드 → 카더라 내부 페이지 자동 연결
 * - SEO: 14,578개 블로그 → 주식/부동산/시리즈 페이지 교차 링크
 * - 1 키워드 = 1 링크만 (과도한 링크 방지), 최대 5개
 */

const STOCK_KEYWORDS: [string, string][] = [
  // 국내 시총 TOP 25
  ['삼성전자', '/stock/005930'], ['SK하이닉스', '/stock/000660'],
  ['LG에너지솔루션', '/stock/373220'], ['삼성바이오로직스', '/stock/207940'],
  ['현대차', '/stock/005380'], ['기아', '/stock/000270'],
  ['KB금융', '/stock/105560'], ['NAVER', '/stock/035420'],
  ['네이버', '/stock/035420'], ['신한지주', '/stock/055550'],
  ['셀트리온', '/stock/068270'], ['POSCO홀딩스', '/stock/005490'],
  ['삼성물산', '/stock/028260'], ['현대모비스', '/stock/012330'],
  ['하나금융지주', '/stock/086790'], ['삼성SDI', '/stock/006400'],
  ['카카오', '/stock/035720'], ['LG화학', '/stock/051910'],
  ['삼성화재', '/stock/000810'], ['한화에어로스페이스', '/stock/012450'],
  ['HD현대중공업', '/stock/329180'], ['KT&G', '/stock/033780'],
  ['알테오젠', '/stock/196170'], ['SK', '/stock/034730'],
  // 인기 해외주
  ['애플', '/stock/AAPL'], ['마이크로소프트', '/stock/MSFT'],
  ['엔비디아', '/stock/NVDA'], ['테슬라', '/stock/TSLA'],
  ['아마존', '/stock/AMZN'], ['구글', '/stock/GOOGL'],
  ['메타', '/stock/META'],
];

const APT_KEYWORDS: [string, string][] = [
  // 17개 광역시도
  ['서울 아파트', '/apt/region/서울'], ['부산 아파트', '/apt/region/부산'],
  ['대구 아파트', '/apt/region/대구'], ['인천 아파트', '/apt/region/인천'],
  ['광주 아파트', '/apt/region/광주'], ['대전 아파트', '/apt/region/대전'],
  ['울산 아파트', '/apt/region/울산'], ['세종 아파트', '/apt/region/세종'],
  ['경기 아파트', '/apt/region/경기'], ['강원 아파트', '/apt/region/강원'],
  ['충북 아파트', '/apt/region/충북'], ['충남 아파트', '/apt/region/충남'],
  ['전북 아파트', '/apt/region/전북'], ['전남 아파트', '/apt/region/전남'],
  ['경북 아파트', '/apt/region/경북'], ['경남 아파트', '/apt/region/경남'],
  ['제주 아파트', '/apt/region/제주'],
  // 인기 구
  ['강남 아파트', '/apt/region/강남구'], ['서초 아파트', '/apt/region/서초구'],
  ['송파 아파트', '/apt/region/송파구'], ['마포 아파트', '/apt/region/마포구'],
  ['해운대 아파트', '/apt/region/해운대구'],
  // 기능
  ['청약 일정', '/apt'], ['미분양 현황', '/apt'],
  ['재개발 현황', '/apt'], ['실거래가 검색', '/apt/search'],
  ['재건축', '/apt'], ['분양 일정', '/apt'],
  // 현장 정보 허브
  ['분양 정보', '/apt/sites'], ['현장 정보', '/apt/sites'],
  ['아파트 분양', '/apt/sites'], ['분양 현장', '/apt/sites'],
];

const FEATURE_KEYWORDS: [string, string][] = [
  ['종목 비교', '/stock/compare'], ['관심종목', '/stock'],
  ['부동산 지도', '/apt/map'], ['블로그 시리즈', '/blog/series'],
  ['투자 캘린더', '/stock'], ['포트폴리오', '/stock'],
  ['부동산 진단', '/apt/diagnose'],
];

const SERIES_KEYWORDS: [string, string][] = [
  ['실거래가 분석', '/blog/series/trade-analysis'],
  ['청약 분석', '/blog/series/subscription-analysis'],
  ['재개발 현황', '/blog/series/redevelopment-status'],
  ['미분양 리포트', '/blog/series/unsold-report'],
  ['종목 분석', '/blog/series/stock-analysis'],
  ['배당주 투자', '/blog/series/dividend-investing'],
  ['재테크 기본', '/blog/series/finance-basics'],
  ['부동산 세금', '/blog/series/real-estate-tax'],
];

const ALL_KEYWORDS = [...STOCK_KEYWORDS, ...APT_KEYWORDS, ...FEATURE_KEYWORDS, ...SERIES_KEYWORDS];

export function injectInternalLinks(html: string): string {
  if (!html || html.length < 200) return html;

  const linked = new Set<string>();
  let result = html;

  for (const [keyword, href] of ALL_KEYWORDS) {
    if (linked.has(keyword)) continue;
    // 2글자 이하 키워드 스킵 (SK, LG 등 과다 매칭 방지)
    if (keyword.length <= 2) continue;

    // <a>, <h2>, <h3>, <code> 태그 안의 텍스트는 건드리지 않음
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

    if (linked.size >= 5) break;
  }

  return result;
}
