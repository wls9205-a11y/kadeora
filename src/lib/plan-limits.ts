/**
 * 카더라 프로 멤버십 — 기능 게이팅 공통 로직
 * 
 * 사용법:
 *   import { FREE_LIMITS, PRO_LIMITS, getLimits, canDo, getLimit } from '@/lib/plan-limits';
 *   const limits = getLimits(user.is_premium);
 *   if (!canDo(user.is_premium, 'apt_compare')) showUpgradeModal();
 *   const max = getLimit(user.is_premium, 'watchlist_stock'); // 5 or -1
 */

export interface PlanLimits {
  watchlist_stock: number;      // 관심 종목 (-1 = 무제한)
  watchlist_apt: number;        // 관심 단지
  price_alerts: number;         // 가격 알림
  ai_analysis_weekly: number;   // 주간 AI 분석 건수
  daily_report: 'weekly' | 'daily'; // 데일리 리포트 빈도
  export_monthly: number;       // 월간 CSV 다운로드
  apt_compare: boolean;         // 단지 비교 도구
  ad_free: boolean;             // 광고 제거
  pro_badge: boolean;           // 프로 배지
  pro_room: boolean;            // 프로 전용 토론방
  push_stock_alert: boolean;    // 급등락 푸시 알림
  push_apt_early: boolean;      // 청약 D-7 사전 알림
  csv_download: boolean;        // CSV 다운로드
  jeonse_ratio_alert: boolean;  // 전세가율 알림
  kakao_support: boolean;       // 카카오톡 1:1 지원
}

export const FREE_LIMITS: PlanLimits = {
  watchlist_stock: 5,
  watchlist_apt: 3,
  price_alerts: 3,
  ai_analysis_weekly: 0,
  daily_report: 'weekly',
  export_monthly: 0,
  apt_compare: false,
  ad_free: false,
  pro_badge: false,
  pro_room: false,
  push_stock_alert: false,
  push_apt_early: false,
  csv_download: false,
  jeonse_ratio_alert: false,
  kakao_support: false,
};

export const PRO_LIMITS: PlanLimits = {
  watchlist_stock: -1,  // 무제한
  watchlist_apt: -1,
  price_alerts: 20,
  ai_analysis_weekly: 5,
  daily_report: 'daily',
  export_monthly: 10,
  apt_compare: true,
  ad_free: true,
  pro_badge: true,
  pro_room: true,
  push_stock_alert: true,
  push_apt_early: true,
  csv_download: true,
  jeonse_ratio_alert: true,
  kakao_support: true,
};

/** 유저의 프리미엄 여부에 따라 제한 반환 */
export function getLimits(isPremium: boolean): PlanLimits {
  return isPremium ? PRO_LIMITS : FREE_LIMITS;
}

/** 특정 기능 사용 가능 여부 (boolean 기능용) */
export function canDo(isPremium: boolean, feature: keyof PlanLimits): boolean {
  const val = getLimits(isPremium)[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0; // 0이면 불가
  return val === 'daily'; // daily_report
}

/** 특정 기능의 수치 제한값 반환 (-1 = 무제한) */
export function getLimit(isPremium: boolean, feature: keyof PlanLimits): number {
  const val = getLimits(isPremium)[feature];
  if (typeof val === 'number') return val;
  return val ? 1 : 0;
}

/** 사용량이 제한 초과인지 체크 */
export function isOverLimit(isPremium: boolean, feature: keyof PlanLimits, currentUsage: number): boolean {
  const limit = getLimit(isPremium, feature);
  if (limit === -1) return false; // 무제한
  return currentUsage >= limit;
}

/** 프로 가격 정보 */
export const PRO_PRICING = {
  monthly: { price: 24900, label: '₩24,900/월', perDay: '₩830/일' },
  yearly: { price: 249000, label: '₩249,000/년', perMonth: '₩20,750/월', discount: '17% 할인' },
  trial: { days: 14, label: '14일 무료 체험' },
} as const;

/** 프로 기능 목록 (UI 표시용) */
export const PRO_FEATURES = [
  { icon: '📈', title: '관심 종목 무제한', desc: '무료 5개 → 무제한', highlight: true },
  { icon: '🏢', title: '관심 단지 무제한', desc: '무료 3개 → 무제한', highlight: true },
  { icon: '🔔', title: '급등락 실시간 알림', desc: '±5% 변동 시 즉시 푸시', highlight: true },
  { icon: '📅', title: '청약 D-7 사전 알림', desc: '마감 전 미리 알려줌', highlight: true },
  { icon: '🤖', title: 'AI 종목 분석', desc: '주 5건 리포트', highlight: false },
  { icon: '📊', title: '데일리 리포트', desc: '매일 아침 7시 (무료: 주1회)', highlight: false },
  { icon: '📥', title: '거래 데이터 CSV', desc: '월 10회 다운로드', highlight: false },
  { icon: '🏠', title: '단지 비교 도구', desc: '2개 단지 시세·전세가율 비교', highlight: false },
  { icon: '📈', title: '전세가율 변동 알림', desc: '관심 단지 전세가율 변동', highlight: false },
  { icon: '🚫', title: '광고 영구 제거', desc: '깨끗한 화면', highlight: false },
  { icon: '⭐', title: '프로 배지', desc: '닉네임 옆 ⭐ 표시', highlight: false },
  { icon: '💬', title: '프로 전용 토론방', desc: '프로 유저만 입장', highlight: false },
  { icon: '💬', title: '1:1 카카오톡 지원', desc: '전용 고객 지원', highlight: false },
] as const;
