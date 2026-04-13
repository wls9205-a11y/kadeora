/**
 * social-proof.ts — 소셜프루프 숫자 유틸리티
 * 
 * 서버: fetchSocialProof() → API 호출 (ISR 1시간 캐시)
 * 클라이언트: useSocialProof() → localStorage 캐시 + API 호출
 * 
 * 모든 소셜프루프 숫자는 이 모듈을 통해 제공
 */

export interface SocialProofData {
  dailyVisitors: number;
  peakVisitors: number;
  todayVisitors: number;
  totalViews: number;
  blogCount: number;
  stockCount: number;
  complexCount: number;
  subscriptionCount: number;
  tradeDataCount: number;
  totalDataPoints: number;
  userCount: number;
}

/** 폴백 기본값 — API 실패 시 사용 */
export const SOCIAL_PROOF_FALLBACK: SocialProofData = {
  dailyVisitors: 1300,
  peakVisitors: 3900,
  todayVisitors: 1200,
  totalViews: 690000,
  blogCount: 7600,
  stockCount: 1800,
  complexCount: 34500,
  subscriptionCount: 2700,
  tradeDataCount: 2600000,
  totalDataPoints: 3300000,
  userCount: 80,
};

/** 포맷 헬퍼: 1234 → "1,234", 692287 → "69만+" */
export function fmtSocial(n: number, style: 'comma' | 'approx' = 'comma'): string {
  if (style === 'approx') {
    if (n >= 1_000_000) return `${Math.floor(n / 10000)}만+`;
    if (n >= 10_000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만+`;
    if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천+`;
    return `${n}`;
  }
  return n.toLocaleString('ko-KR');
}

/** 서버 사이드: 소셜프루프 데이터 가져오기 (ISR 캐시) */
export async function fetchSocialProof(): Promise<SocialProofData> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
    const res = await fetch(`${baseUrl}/api/stats/social-proof`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return SOCIAL_PROOF_FALLBACK;
    return await res.json();
  } catch {
    return SOCIAL_PROOF_FALLBACK;
  }
}
