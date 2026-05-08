// src/lib/search/parse-query.ts — s260
// 자연어 검색어 파싱 — "4월 청약" → { category:'subscription', month:4 }
// 사용자 검색 행동 분석 결과 ("4월 청약" 11회, "2026" 8회) 를 토대로 작성

export type ParsedQuery = {
  raw: string;          // 입력 그대로
  cleaned: string;      // 토큰 분리 후 합친 검색용
  tokens: string[];     // 의미 단위
  category?: SearchCategory;     // 카테고리 힌트
  month?: number;       // 1~12
  year?: number;        // 4자리 연도
  region?: string;      // 지역 힌트 (단어 수준)
};

export type SearchCategory =
  | "subscription"   // 청약
  | "complex"        // 단지
  | "redev"          // 재개발
  | "unsold"         // 미분양
  | "trade"          // 실거래
  | "stock"          // 주식
  | "blog";          // 블로그

// 카테고리 힌트 (한글 키워드 → category)
const CATEGORY_HINTS: { keywords: string[]; category: SearchCategory }[] = [
  { keywords: ["청약", "분양", "1순위", "특별공급", "당첨"],            category: "subscription" },
  { keywords: ["재개발", "재건축", "정비사업", "조합"],                  category: "redev" },
  { keywords: ["미분양", "할인", "잔여세대"],                            category: "unsold" },
  { keywords: ["실거래", "거래", "매매가", "전세가", "월세"],            category: "trade" },
  { keywords: ["코스피", "코스닥", "kospi", "kosdaq", "주식", "종목"],   category: "stock" },
  { keywords: ["블로그", "글", "분석"],                                  category: "blog" },
];

// 광역시/도 (region 힌트)
const REGION_KEYWORDS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const MONTH_PATTERNS: RegExp[] = [
  /(\d{1,2})\s*월/,     // "4월", "12월"
  /\b(\d{1,2})m\b/i,     // "4m"
];

const YEAR_PATTERNS: RegExp[] = [
  /(20\d{2})\s*년?/,    // "2026", "2026년"
];

export function parseSearchQuery(input: string): ParsedQuery {
  const raw = input ?? "";
  const trimmed = raw.trim();
  const result: ParsedQuery = {
    raw,
    cleaned: trimmed,
    tokens: [],
  };

  if (!trimmed) return result;

  // 1) 연도 추출
  for (const pat of YEAR_PATTERNS) {
    const m = trimmed.match(pat);
    if (m) {
      const y = parseInt(m[1], 10);
      if (y >= 2020 && y <= 2030) {
        result.year = y;
        break;
      }
    }
  }

  // 2) 월 추출
  for (const pat of MONTH_PATTERNS) {
    const m = trimmed.match(pat);
    if (m) {
      const mo = parseInt(m[1], 10);
      if (mo >= 1 && mo <= 12) {
        result.month = mo;
        break;
      }
    }
  }

  // 3) 카테고리 힌트
  const lower = trimmed.toLowerCase();
  for (const { keywords, category } of CATEGORY_HINTS) {
    if (keywords.some((k) => lower.includes(k))) {
      result.category = category;
      break;
    }
  }

  // 4) 지역 힌트 (광역 단위만 — sigungu/dong 은 RPC 가 처리)
  for (const r of REGION_KEYWORDS) {
    if (trimmed.includes(r)) {
      result.region = r;
      break;
    }
  }

  // 5) 토큰 분리 (공백 + 의미있는 키워드 추출)
  result.tokens = trimmed
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .filter((t) => !/^(20\d{2}년?|\d{1,2}월)$/.test(t));  // 시간 토큰은 별도 처리됐으니 제외

  // 6) cleaned: 검색 RPC 에 보낼 핵심 키워드 (시간/카테고리 토큰 제거 후)
  const filterTokens = new Set([
    ...REGION_KEYWORDS,
    ...CATEGORY_HINTS.flatMap((h) => h.keywords),
  ]);
  const coreTokens = result.tokens.filter(
    (t) => !filterTokens.has(t.toLowerCase()),
  );

  result.cleaned = coreTokens.length > 0 ? coreTokens.join(" ") : trimmed;

  return result;
}

// "4월 청약" 형태 검색 시 카테고리별 결과 가중치 부스트
export function boostCategoryScore(
  parsed: ParsedQuery,
  resultCategory: string,
  baseScore: number,
): number {
  if (parsed.category && resultCategory === parsed.category) {
    return baseScore * 1.5;
  }
  return baseScore;
}

// 검색 결과 응답 형태 (RPC v3 반환과 일치)
export type SearchResultItem = {
  id: string;
  title: string;
  url: string;
  type: string;
  subtitle?: string;
  score?: number;
  cover_image_url?: string | null;
  // 카테고리별 추가 필드 (optional)
  rcept_bgnde?: string;
  rcept_endde?: string;
  dday?: number;
  status?: string;
  price?: number;
  change_pct?: number;
  view_count?: number;
  likes?: number;
  count?: number;       // 지역 검색 시 매칭 수
  [key: string]: any;   // 미래 확장 허용
};

export type UnifiedSearchResponse = {
  query: string;
  total: number;
  apt_sites?: SearchResultItem[];
  complexes?: SearchResultItem[];
  subscriptions?: SearchResultItem[];
  redev?: SearchResultItem[];
  unsold?: SearchResultItem[];
  blogs?: SearchResultItem[];
  posts?: SearchResultItem[];
  stocks?: SearchResultItem[];
  regions?: SearchResultItem[];
  priority_order?: string[];
  error?: string;
};

// 결과 합산 (모든 도메인) — typeahead 용
export function flattenResults(
  resp: UnifiedSearchResponse,
  limitPerType = 3,
): SearchResultItem[] {
  const order = resp.priority_order ?? [
    "apt_sites", "complexes", "subscriptions",
    "redev", "unsold", "regions",
    "blogs", "posts", "stocks",
  ];
  const out: SearchResultItem[] = [];
  for (const k of order) {
    const arr = (resp as any)[k] as SearchResultItem[] | undefined;
    if (Array.isArray(arr)) out.push(...arr.slice(0, limitPerType));
  }
  return out;
}

// 카테고리 한글 라벨
export const CATEGORY_KO: Record<string, { label: string; emoji: string }> = {
  apt_sites:     { label: "분양 단지",   emoji: "🏗" },
  complexes:     { label: "단지",         emoji: "🏢" },
  subscriptions: { label: "청약공고",     emoji: "📋" },
  redev:         { label: "재개발",       emoji: "🏘" },
  unsold:        { label: "미분양",       emoji: "🗝" },
  regions:       { label: "지역",         emoji: "🗺" },
  blogs:         { label: "블로그",       emoji: "📰" },
  posts:         { label: "커뮤니티",     emoji: "💬" },
  stocks:        { label: "종목",         emoji: "📈" },
};
