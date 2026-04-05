/**
 * 관심단지 등록 카운트 — 허수 표시 유틸리티
 * 
 * 로직: 공급세대수 × 0.5를 기본 카운트로 표시
 * 실 등록이 0.5배를 초과하면 실 데이터 표시
 * 
 * DB에는 실 데이터만 저장. 허수는 프론트에서만 계산.
 */

export function getDisplayInterestCount(
  realCount: number,
  totalSupply: number | null | undefined
): number {
  if (!totalSupply || totalSupply <= 0) return Math.max(realCount, 10);
  const virtualBase = Math.round(totalSupply * 0.5);
  return Math.max(realCount, virtualBase);
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
