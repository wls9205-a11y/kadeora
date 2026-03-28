/**
 * 블로그 본문 HTML에 자동 내부링크 삽입
 * - 키워드 → 카더라 내부 페이지 자동 연결
 * - SEO: 19,000개 블로그 → 주식/부동산/시리즈 페이지 교차 링크
 * - 1 키워드 = 1 링크만 (과도한 링크 방지), 최대 7개
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
  ['분양 정보', '/apt'], ['현장 정보', '/apt'],
  ['아파트 분양', '/apt'], ['분양 현장', '/apt'],
];

const EXTERNAL_KEYWORDS: [string, string][] = [
  ['부산 급매물', 'https://xn--kj0bw8tr3a.com'],
  ['부산 부동산 급매물', 'https://xn--kj0bw8tr3a.com'],
  ['분양권 투자', 'https://xn--zf0bv61a84di4cc7c4tay28c.com'],
  ['분양권 실전투자', 'https://xn--zf0bv61a84di4cc7c4tay28c.com'],
];

const FEATURE_KEYWORDS: [string, string][] = [
  ['종목 비교', '/stock/compare'], ['관심종목', '/stock'],
  ['부동산 지도', '/apt/map'],
  ['투자 캘린더', '/stock'], ['포트폴리오', '/stock'],
  ['부동산 진단', '/apt/diagnose'],
  // 추가 내부 링크
  ['실거래가', '/apt?tab=trade'],
  ['청약 경쟁률', '/apt/diagnose'],
  ['청약 가점', '/apt/diagnose'],
  ['청약 진단', '/apt/diagnose'],
  ['미분양 현황', '/apt?tab=unsold'],
  ['재개발 현황', '/apt?tab=redev'],
  ['테마주', '/stock'],
  ['배당주', '/stock'],
  ['환율', '/stock'],
];

// 재테크·금융 블로그 내부링크 (finance/general 카테고리)
const FINANCE_KEYWORDS: [string, string][] = [
  ['ISA 계좌', '/blog/isa-계좌-서민형-일반형-중개형-2026'],
  ['연금저축', '/blog/연금저축펀드-vs-irp-2026-세액공제-완전-비교'],
  ['IRP 계좌', '/blog/irp-중도-인출-조건-세금-완전-정리'],
  ['청년도약계좌', '/blog/청년도약계좌-가입-조건-혜택-2026'],
  ['실업급여', '/blog/실업급여-수급-조건-금액-기간-2026'],
  ['종합소득세', '/blog/2026-종합소득세-신고-완전-가이드-프리랜서'],
  ['건강보험료', '/blog/건강보험료-절약법-피부양자-조건-지역가입자-2026'],
  ['연말정산', '/blog/연말정산-완전-가이드-공제-항목-환급'],
  ['주택청약', '/blog/주택청약종합저축-1순위-청약-전략'],
  ['디딤돌 대출', '/blog/디딤돌-대출-조건-금리-한도-2026-가이드'],
  ['주택연금', '/blog/역모기지론-주택연금-집으로-연금받기'],
  ['ETF 투자', '/blog/미국etf-완전가이드-qqq-spy-schd-2026'],
  ['배당 재투자', '/blog/배당-재투자-drip-복리-전략'],
  ['자산 배분', '/blog/자산-배분-원칙-주식-채권-현금'],
  ['가상자산 세금', '/blog/가상자산-세금-과세-신고-방법-2026'],
  ['FIRE 조기은퇴', '/blog/fire-조기은퇴-한국형-파이어족-가이드'],
  ['퇴직연금', '/blog/퇴직연금-dc형-etf-운용-전략'],
];

const SERIES_KEYWORDS: [string, string][] = [
  ['블로그 시리즈', '/blog/series'],
];

const GUIDE_KEYWORDS: [string, string][] = [
  ['청약통장', '/apt/diagnose'],
];

const ALL_KEYWORDS = [...STOCK_KEYWORDS, ...APT_KEYWORDS, ...FINANCE_KEYWORDS, ...FEATURE_KEYWORDS, ...SERIES_KEYWORDS, ...GUIDE_KEYWORDS];

// 정규식 사전 컴파일 (모듈 로딩 시 1회) — 블로그 렌더링 성능 최적화
function buildPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?<![<\\/\\w])(?<!href=")(?<!">)(${escaped})(?![^<]*<\\/a>)(?![^<]*<\\/h[23]>)(?![^<]*<\\/code>)`,
    ''
  );
}

const COMPILED_KEYWORDS: [RegExp, string, string][] = ALL_KEYWORDS
  .filter(([kw]) => kw.length > 2)
  .map(([kw, href]) => [buildPattern(kw), href, kw]);

const COMPILED_EXTERNAL: [RegExp, string, string][] = EXTERNAL_KEYWORDS
  .filter(([kw]) => kw.length > 2)
  .map(([kw, href]) => [buildPattern(kw), href, kw]);

export function injectInternalLinks(html: string): string {
  if (!html || html.length < 200) return html;

  const linked = new Set<string>();
  let result = html;
  let externalLinked = false;

  // Internal links — 사전 컴파일된 정규식 사용
  for (const [pattern, href, keyword] of COMPILED_KEYWORDS) {
    if (linked.has(keyword)) continue;

    if (pattern.test(result)) {
      result = result.replace(
        pattern,
        `<a href="${href}" style="color:var(--brand);text-decoration:underline;text-underline-offset:2px" title="${keyword} — 카더라">${keyword}</a>`
      );
      linked.add(keyword);
    }

    if (linked.size >= 7) break;
  }

  // External links — 사전 컴파일된 정규식 사용
  for (const [pattern, href, keyword] of COMPILED_EXTERNAL) {
    if (externalLinked) break;

    if (pattern.test(result)) {
      result = result.replace(
        pattern,
        `<a href="${href}" target="_blank" rel="noopener nofollow" style="color:var(--brand);text-decoration:underline;text-underline-offset:2px" title="${keyword}">${keyword}</a>`
      );
      externalLinked = true;
    }
  }

  return result;
}
