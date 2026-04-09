/**
 * 관심단지 등록 카운트 — 소셜프루프 표시 유틸리티
 * 
 * 원칙: DB에는 실 데이터만 저장. 프론트 표시만 보정.
 * 실 등록이 기본값 초과하면 실 데이터 사용.
 */
export function getDisplayInterestCount(
  realCount: number,
  totalSupply: number | null | undefined
): number {
  if (!totalSupply || totalSupply <= 0) {
    return Math.max(realCount, 12 + (realCount * 7) % 17);
  }
  const virtualBase = Math.round(totalSupply * 0.03) + 8;
  const capped = Math.min(Math.max(virtualBase, 12), 300);
  return Math.max(realCount, capped);
}

/**
 * 관심등록 수를 사용자 친화적 텍스트로 변환
 */
export function formatInterestText(
  realCount: number,
  totalSupply: number | null | undefined
): string {
  const display = getDisplayInterestCount(realCount, totalSupply);
  if (display >= 100) return `${Math.floor(display / 10) * 10}+명이 주목`;
  if (display >= 30) return `${Math.floor(display / 5) * 5}+명이 관심`;
  return `${display}명이 관심`;
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
