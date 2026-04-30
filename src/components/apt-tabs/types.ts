/**
 * apt-tabs 공유 타입
 *
 * 4탭에서 공통으로 사용하는 데이터 모델.
 * fetcher 결과는 이 형태로 정규화되어 컴포넌트로 전달됨.
 */

export type BadgeKind = 'pink' | 'amber' | 'green' | 'gray' | 'red' | 'blue';

export type ToneKind = 'positive' | 'negative' | 'neutral';

export type CategoryId =
  | 'subscription'
  | 'transactions'
  | 'site'
  | 'redevelopment'
  | 'unsold'
  | 'data';

export type Region = {
  parentName: string;  // "서울 강남구"
  name: string;        // "압구정동"
  code: string;        // "1168011000"
};

export type AptSiteCover = {
  id: string;
  name: string;
  cover_image_url: string | null;
  cover_image_kind: 'official' | 'satellite' | 'ai' | 'initial' | null;
  cover_image_source?: string | null;
  cover_image_blurhash?: string | null;
};

export type Kpi = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: ToneKind;
};

/* ============================================================
 * 탭별 데이터
 * ============================================================ */

export type SubscriptionItem = {
  id: string;
  site: AptSiteCover;
  dDay: number;             // 마감까지 D-day
  unitCount: number;        // 124
  unitSizes: string;        // "84·112㎡"
  avgPrice: number;         // 원 단위 (28e8)
  expectedCompetition: number; // 124 (124:1)
  minScore?: number;        // 68
  href: string;
};

export type TransactionItem = {
  id: string;
  site: AptSiteCover;
  date: string;             // ISO
  areaSqm: number;          // 84
  floor?: number;           // 12
  price: number;            // 원
  changePct?: number;       // 3.2
  isRecordHigh: boolean;
  href: string;
};

export type RedevelopmentItem = {
  id: string;
  site: AptSiteCover;
  phaseId: 'planning' | 'union' | 'project' | 'management' | 'demolition' | 'construction' | 'completion';
  phaseLabel: string;       // "조합설립"
  progressPct: number;      // 42
  nextMilestoneLabel?: string; // "사업시행인가"
  nextMilestoneDDay?: number;  // 180
  members?: number;         // 1184 (조합원)
  href: string;
};

export type UnsoldItem = {
  id: string;
  site: AptSiteCover;
  remainingUnits: number;   // 8
  unitSizes: string;        // "84·112㎡"
  originalPrice: number;    // 원
  currentPrice: number;     // 원
  discountPct: number;      // 12
  benefits: { label: string; value: string }[];
  href: string;
};

export type UnsoldTrendPoint = {
  month: string;            // "2025-05"
  count: number;
};

export type PriceChartPoint = {
  date: string;             // "2025-05-01"
  pricePerPyeong: number;   // 원
};

export type PriceChartRange = '3M' | '6M' | '12M' | '3Y';
