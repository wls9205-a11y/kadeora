/**
 * 관심단지 표시 유틸리티 — 정직한 소셜프루프
 * 
 * 원칙: 허수 없음. 실 데이터만 표시.
 * - 관심등록 있으면 → 실제 수치 표시
 * - 관심등록 0이면 → 조회수 또는 행동유도 문구 표시
 */

/** 관심등록 카운트 표시 (허수 없이) */
export function getDisplayInterestCount(
  realCount: number,
  _totalSupply?: number | null
): number {
  return realCount;
}

/** 
 * KPI 카드용: 관심 또는 조회수 중 더 나은 것 표시
 * 관심 > 0 → "12명이 관심"
 * 관심 = 0, 조회 > 0 → "32명이 조회" 
 * 둘 다 0 → "등록하기"
 */
export function formatInterestOrViews(
  interestCount: number,
  pageViews: number
): { label: string; value: string; metric: 'interest' | 'views' | 'cta' } {
  if (interestCount > 0) {
    return { label: '관심', value: `${interestCount}명`, metric: 'interest' };
  }
  if (pageViews > 0) {
    // 조회수는 실 데이터 — 10단위 반올림으로 자연스럽게
    const rounded = pageViews >= 100 
      ? `${Math.floor(pageViews / 10) * 10}+` 
      : String(pageViews);
    return { label: '조회', value: `${rounded}명`, metric: 'views' };
  }
  return { label: '관심', value: '등록하기', metric: 'cta' };
}

/**
 * InterestRegistration용: 0명이면 숫자 대신 행동유도
 */
export function formatInterestText(
  realCount: number,
  _totalSupply?: number | null
): string {
  if (realCount >= 100) return `${Math.floor(realCount / 10) * 10}+명이 관심`;
  if (realCount > 0) return `${realCount}명이 관심`;
  return '첫 번째로 등록하기';
}

/**
 * 취득세 자동 계산 (1주택 기준)
 * 
 * 6억 이하: 1%
 * 6~9억: 1~3% (구간별 계산)
 * 9억 초과: 3%
 * + 지방교육세 (취득세의 10%)
 * + 농특세 (85㎡ 초과 시 취득세의 20%)
 */
export function calcAcquisitionTax(
  priceManWon: number,
  exclusiveAreaSqm: number
): { tax: number; education: number; rural: number; total: number } {
  const price = priceManWon; // 만원 단위
  
  let taxRate: number;
  if (price <= 60000) {
    taxRate = 0.01;
  } else if (price <= 90000) {
    // 6~9억 구간: 선형 보간 1%~3%
    taxRate = 0.01 + ((price - 60000) / 30000) * 0.02;
  } else {
    taxRate = 0.03;
  }
  
  const tax = Math.round(price * taxRate);
  const education = Math.round(tax * 0.1);
  const rural = exclusiveAreaSqm > 85 ? Math.round(tax * 0.2) : 0;
  const total = tax + education + rural;
  
  return { tax, education, rural, total };
}

/**
 * 평당가 계산 (만원 단위)
 */
export function calcPricePerPyeong(priceManWon: number, exclusiveAreaSqm: number): number {
  if (exclusiveAreaSqm <= 0 || priceManWon <= 0) return 0;
  return Math.round(priceManWon / (exclusiveAreaSqm / 3.3058));
}
