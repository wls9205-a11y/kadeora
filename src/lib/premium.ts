/**
 * 프리미엄 멤버십 체크 유틸리티
 * 서버/클라이언트 양쪽에서 사용 가능
 */

export interface PremiumStatus {
  isPremium: boolean;
  expiresAt: string | null;
  daysLeft: number;
}

/**
 * 프로필 데이터로 프리미엄 상태 계산
 */
export function checkPremiumStatus(profile: {
  is_premium?: boolean | null;
  premium_expires_at?: string | null;
} | null): PremiumStatus {
  if (!profile) return { isPremium: false, expiresAt: null, daysLeft: 0 };

  const now = new Date();
  const expiresAt = profile.premium_expires_at;

  if (!profile.is_premium || !expiresAt) {
    return { isPremium: false, expiresAt: null, daysLeft: 0 };
  }

  const expiryDate = new Date(expiresAt);
  if (expiryDate <= now) {
    return { isPremium: false, expiresAt, daysLeft: 0 };
  }

  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return { isPremium: true, expiresAt, daysLeft };
}

/**
 * 프리미엄 전용 기능 게이트
 * 사용: if (!requirePremium(profile)) return "upgrade needed"
 */
export function requirePremium(profile: {
  is_premium?: boolean | null;
  premium_expires_at?: string | null;
} | null): boolean {
  return checkPremiumStatus(profile).isPremium;
}
